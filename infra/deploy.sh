#!/bin/bash
set -e

AWS_REGION="ap-northeast-2"
AWS_ACCOUNT="541974874550"
ECR_BASE="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
TAG="${1:-latest}"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_BASE

echo "==> Building and pushing images (linux/amd64)..."
docker buildx build --platform linux/amd64 --provenance=false \
  -t $ECR_BASE/forgenta-api:$TAG --push -f Dockerfile .
docker buildx build --platform linux/amd64 --provenance=false \
  -t $ECR_BASE/forgenta-ollama:$TAG --push -f ollama/Dockerfile ollama/

echo "==> Registering task definition..."
aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/task-definition.json \
  --region $AWS_REGION

echo "==> Updating ECS service..."
aws ecs update-service \
  --cluster forgenta \
  --service forgenta-api \
  --task-definition forgenta \
  --force-new-deployment \
  --region $AWS_REGION

echo "Done. Monitor: https://console.aws.amazon.com/ecs/home?region=${AWS_REGION}#/clusters/forgenta/services"
