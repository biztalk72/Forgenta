package router

import (
	"os"
	"path/filepath"
	"testing"
)

const sampleYAML = `
routes:
  - match: "qwen3-72b-*"
    backend: "vllm-planner"
    fallback: ["vllm-summarizer", "ollama"]
    fallback_rewrite:
      ollama: "qwen3:8b"
  - match: "qwen3-coder-32b*"
    backend: "vllm-executor"
    fallback: ["ollama"]
  - match: "claude-*"
    backend: "external"
backends:
  vllm-planner:    "http://vllm-planner.forgenta-llm:8000"
  vllm-summarizer: "http://vllm-summarizer.forgenta-llm:8000"
  vllm-executor:   "http://vllm-executor.forgenta-llm:8000"
  ollama:          "http://ollama.forgenta-llm:11434"
`

func writeTemp(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "routes.yaml")
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestResolvePlanner(t *testing.T) {
	tbl, err := Load(writeTemp(t, sampleYAML))
	if err != nil {
		t.Fatal(err)
	}
	r, err := tbl.Resolve("qwen3-72b-instruct-nvfp4")
	if err != nil {
		t.Fatal(err)
	}
	if r.Backend != "vllm-planner" {
		t.Fatalf("backend=%s want vllm-planner", r.Backend)
	}
	if r.URL.Host != "vllm-planner.forgenta-llm:8000" {
		t.Fatalf("host=%s", r.URL.Host)
	}
	if len(r.Fallback) != 2 {
		t.Fatalf("fallback count=%d want 2", len(r.Fallback))
	}
	// vllm-summarizer 폴백은 rewrite 없음, ollama 폴백은 "qwen3:8b" 로 리라이트.
	if r.Fallback[0].Backend != "vllm-summarizer" || r.Fallback[0].RewriteModel != "" {
		t.Fatalf("fallback[0]=%+v want vllm-summarizer/no-rewrite", r.Fallback[0])
	}
	if r.Fallback[1].Backend != "ollama" || r.Fallback[1].RewriteModel != "qwen3:8b" {
		t.Fatalf("fallback[1]=%+v want ollama/qwen3:8b", r.Fallback[1])
	}
}

func TestResolveExternal(t *testing.T) {
	tbl, err := Load(writeTemp(t, sampleYAML))
	if err != nil {
		t.Fatal(err)
	}
	r, err := tbl.Resolve("claude-3-7-sonnet")
	if err != nil {
		t.Fatal(err)
	}
	if !r.External {
		t.Fatal("expected external")
	}
}

func TestResolveNoMatch(t *testing.T) {
	tbl, err := Load(writeTemp(t, sampleYAML))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tbl.Resolve("unknown-model"); err == nil {
		t.Fatal("expected error")
	}
}
