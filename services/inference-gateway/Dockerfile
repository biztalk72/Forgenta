# inference-gateway 멀티스테이지 빌드 (repo 루트를 컨텍스트로 빌드 — shared 모듈 포함)
FROM golang:1.26 AS build
WORKDIR /src
COPY services/shared ./services/shared
COPY services/inference-gateway ./services/inference-gateway
WORKDIR /src/services/inference-gateway
RUN CGO_ENABLED=0 go build -o /server ./cmd

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
EXPOSE 8800
ENTRYPOINT ["/server"]
