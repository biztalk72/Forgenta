SERVICE := orchestration-svc
PORT := 8002

.PHONY: install test docker-build lint health run

install:
	pip install -e ".[dev]"

test:
	pytest tests/ -v

docker-build:
	docker build --platform linux/arm64 -t forgenta/$(SERVICE):latest .

lint:
	ruff check app/ && mypy app/

run:
	uvicorn app.main:app --host 0.0.0.0 --port $(PORT)

health:
	curl -sf http://localhost:$(PORT)/health | jq .
