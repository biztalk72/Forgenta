#!/usr/bin/env bash
# Ollama 모델 다운로드 (PRD v2 §3.1). 대용량 다운로드이므로 수동 실행 권장.
# RAM 제약(32GB)에 따라 qwen3:14b/gemma3:12b 동시 상주는 context-notes 결정 후 조정한다.
set -euo pipefail

MODELS=(
  "qwen3:1.7b"   # Router/Summarizer
  "qwen3:8b"     # Executor/Summarizer
  "qwen3:14b"    # Planner
  "gemma3:12b"   # Executor 후보
)

for m in "${MODELS[@]}"; do
  echo "=== pulling $m ==="
  ollama pull "$m"
done
