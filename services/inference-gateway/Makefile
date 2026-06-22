SERVICE := inference-gateway
PORT := 8800

.PHONY: build test docker-build lint health

build:
	go build -o bin/server ./cmd

test:
	go test ./... -race

docker-build:
	docker build --platform linux/arm64 -t forgenta/$(SERVICE):latest -f Dockerfile ../..

lint:
	go vet ./...

health:
	curl -sf http://localhost:$(PORT)/health | jq .
