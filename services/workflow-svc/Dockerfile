# Workflow-Svc 컨테이너 빌드 (멀티스테이지, repo 루트 컨텍스트 — shared 모듈 포함)
FROM golang:1.26 AS build
WORKDIR /src
COPY services/shared ./services/shared
COPY services/workflow-svc ./services/workflow-svc
WORKDIR /src/services/workflow-svc
RUN CGO_ENABLED=0 go build -o /server ./cmd

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
EXPOSE 8006
ENTRYPOINT ["/server"]
