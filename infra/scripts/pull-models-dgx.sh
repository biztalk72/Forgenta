#!/usr/bin/env bash
# Forgenta v3.4 — DGX 모델 풀 (HuggingFace + Ollama).
# 호스트 /var/lib/forgenta/models 에 미리 다운로드. vLLM Pod 가 같은 디렉터리를 hostPath 로 마운트.
set -euo pipefail

MODELS_ROOT="${MODELS_ROOT:-/var/lib/forgenta/models}"
HF_HOME="${HF_HOME:-$MODELS_ROOT/hf}"
OLLAMA_MODELS_DIR="${OLLAMA_MODELS_DIR:-$MODELS_ROOT/ollama}"

mkdir -p "$HF_HOME" "$OLLAMA_MODELS_DIR"
export HF_HOME

# HF 1.20+ 에서 `huggingface-cli` 는 `hf` 로 리네임.
HF_BIN="hf"
if ! command -v "$HF_BIN" >/dev/null 2>&1; then
  HF_BIN="huggingface-cli"
  command -v "$HF_BIN" >/dev/null 2>&1 || { echo "MISSING: hf (huggingface_hub CLI)"; exit 1; }
fi

# Planner (Qwen3-72B-Instruct) — NVFP4 가용성은 HF 확인 후. 1차는 BF16, 후속 NVFP4 승격.
PLANNER_REPO="${PLANNER_REPO:-Qwen/Qwen3-72B-Instruct}"
EXECUTOR_REPO="${EXECUTOR_REPO:-Qwen/Qwen3-Coder-32B-Instruct}"
ROUTER_REPO="${ROUTER_REPO:-Qwen/Qwen3-1.7B}"
SUMMARIZER_REPO="${SUMMARIZER_REPO:-Qwen/Qwen3-8B}"
EMBED_REPO="${EMBED_REPO:-BAAI/bge-m3}"

echo "=== HF model fetch (HF_HOME=$HF_HOME) ==="
for repo in "$PLANNER_REPO" "$EXECUTOR_REPO" "$ROUTER_REPO" "$SUMMARIZER_REPO" "$EMBED_REPO"; do
  echo "[hf] $repo"
  "$HF_BIN" download "$repo" --quiet \
    --exclude "*.bin" \
    || echo "WARN: $repo download failed (재시도/HF 로그인 필요할 수 있음)"
done

# Ollama 폴백 풀 — Ollama 가 클러스터 내부에서 init 컨테이너로도 수행하므로 호스트 사전 풀은 선택.
if command -v ollama >/dev/null 2>&1 && [[ "${PULL_OLLAMA_HOST:-false}" == "true" ]]; then
  echo "=== ollama host-side prefetch ==="
  OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama pull qwen3:1.7b || true
  OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama pull qwen3:8b   || true
fi

echo "=== done. cache layout ==="
du -sh "$MODELS_ROOT"/* 2>/dev/null || true
