{{/* Forgenta LLM helpers */}}

{{- define "forgenta-llm.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/part-of: forgenta
app.kubernetes.io/component: llm
app.kubernetes.io/managed-by: helm
forgenta.io/profile: dgx
{{- end -}}

{{/* vLLM Deployment template — 호출 시 dict 인자 (root + service) */}}
{{- define "forgenta-llm.vllm-deployment" -}}
{{- $root := .root -}}
{{- $svc  := .svc  -}}
{{- $modelsRO := $root.Values.common.readOnlyModels -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $svc.name }}
  namespace: {{ $root.Values.namespace }}
  labels:
    {{- include "forgenta-llm.labels" (dict "name" $svc.name) | nindent 4 }}
spec:
  replicas: 1
  strategy:
    type: Recreate                    # GPU 점유 Pod 동시 가동 금지
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ $svc.name }}
  template:
    metadata:
      labels:
        {{- include "forgenta-llm.labels" (dict "name" $svc.name) | nindent 8 }}
    spec:
      {{- if $root.Values.priorityClass.create }}
      priorityClassName: {{ $root.Values.priorityClass.name }}
      {{- end }}
      runtimeClassName: nvidia        # NVIDIA Container Runtime
      containers:
        - name: vllm
          image: {{ $root.Values.vllm.image }}
          imagePullPolicy: {{ $root.Values.common.imagePullPolicy }}
          args:
            - "--model={{ $svc.model }}"
            - "--served-model-name={{ $svc.servedModelName }}"
            - "--host=0.0.0.0"
            - "--port={{ $root.Values.vllm.port }}"
            - "--max-model-len={{ $svc.maxModelLen }}"
            - "--tensor-parallel-size={{ $svc.tensorParallelSize }}"
            - "--gpu-memory-utilization={{ $svc.gpuMemoryUtilization }}"
            {{- if $svc.quantization }}
            - "--quantization={{ $svc.quantization }}"
            {{- end }}
            {{- if $svc.task }}
            - "--task={{ $svc.task }}"
            {{- end }}
            {{- range $svc.extraArgs }}
            - {{ . | quote }}
            {{- end }}
          ports:
            - name: http
              containerPort: {{ $root.Values.vllm.port }}
          env:
            - name: HF_HOME
              value: {{ $root.Values.common.hfHome }}
            - name: VLLM_LOGGING_LEVEL
              value: INFO
            - name: NVIDIA_VISIBLE_DEVICES
              value: all
            - name: NVIDIA_DRIVER_CAPABILITIES
              value: compute,utility
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 60
            periodSeconds: 10
            failureThreshold: 30        # 대형 모델 로드 시간 허용
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 600
            periodSeconds: 30
          volumeMounts:
            - name: models
              mountPath: /models
              readOnly: {{ $modelsRO }}
            - name: shm
              mountPath: /dev/shm
          resources:
            {{- toYaml $svc.resources | nindent 12 }}
      volumes:
        - name: models
          hostPath:
            path: {{ $root.Values.modelsHostPath }}
            type: DirectoryOrCreate
        - name: shm
          emptyDir:
            medium: Memory
            sizeLimit: 8Gi
---
apiVersion: v1
kind: Service
metadata:
  name: {{ $svc.name }}
  namespace: {{ $root.Values.namespace }}
  labels:
    {{- include "forgenta-llm.labels" (dict "name" $svc.name) | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: {{ $svc.name }}
  ports:
    - name: http
      port: {{ $root.Values.vllm.port }}
      targetPort: http
{{- end -}}
