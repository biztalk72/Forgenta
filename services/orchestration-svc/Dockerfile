# Orchestration-Svc 컨테이너 빌드 (Python 3.12 slim, 컨텍스트 = 서비스 디렉터리)
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
