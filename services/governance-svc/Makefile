SERVICE := governance-svc
PORT := 8005

.PHONY: build test docker-build lint health

build:
	go build -o bin/server ./cmd

test:
	go test ./... -race

docker-build:
	docker build --platform linux/arm64 -t forgenta/$(SERVICE):latest .

lint:
	go vet ./...

health:
	curl -sf http://localhost:$(PORT)/health | jq .
