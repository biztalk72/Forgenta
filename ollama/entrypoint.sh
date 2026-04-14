#!/bin/sh
# Start Ollama server in background, pull models if not cached, then keep serving
ollama serve &
SERVER_PID=$!

# Wait for server to be ready
until ollama list > /dev/null 2>&1; do
  sleep 1
done

# Pull models if not already present
ollama list | grep -q "qwen3:0.6b"    || ollama pull qwen3:0.6b
ollama list | grep -q "nomic-embed-text" || ollama pull nomic-embed-text

# Keep server running
wait $SERVER_PID
