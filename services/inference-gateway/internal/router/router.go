// 라우팅 테이블 — model 글롭 매칭 + fallback 체인.
// YAML 스키마:
//
//	routes:
//	  - match: "qwen3-72b-*"
//	    backend: "vllm-planner"
//	    fallback: ["vllm-summarizer", "ollama"]
//	backends:
//	  vllm-planner:    "http://vllm-planner.forgenta-llm:8000"
//	  vllm-summarizer: "http://vllm-summarizer.forgenta-llm:8000"
//	  ollama:          "http://ollama.forgenta-llm:11434"
package router

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Route struct {
	Match    string   `yaml:"match"`              // glob 패턴 (e.g. "qwen3-72b-*")
	Backend  string   `yaml:"backend"`            // backends 키 참조 또는 "external"
	Fallback []string `yaml:"fallback,omitempty"` // 실패 시 시도할 백엔드 키 순서
	// Sensitive 가 true 이면 X-Forgenta-Sensitive=true 요청만 허용해야 한다.
	// (현재는 표시 메타로만 사용 — sensitive 거부는 server 레이어에서 backend=="external" 차단으로 처리)
	Sensitive bool `yaml:"sensitive,omitempty"`
}

type Table struct {
	Routes   []Route           `yaml:"routes"`
	Backends map[string]string `yaml:"backends"`
}

type Resolved struct {
	Model    string
	Backend  string   // 1차 backend key
	URL      *url.URL // 1차 backend URL
	Fallback []*url.URL
	External bool // backend == "external"
}

// Load reads routing table from YAML file. Empty path returns empty table.
func Load(path string) (*Table, error) {
	if path == "" {
		return &Table{}, nil
	}
	abs, _ := filepath.Abs(path)
	b, err := os.ReadFile(abs)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", abs, err)
	}
	var t Table
	if err := yaml.Unmarshal(b, &t); err != nil {
		return nil, fmt.Errorf("parse %s: %w", abs, err)
	}
	// validate backend URLs
	for name, raw := range t.Backends {
		if _, err := url.Parse(raw); err != nil {
			return nil, fmt.Errorf("backend %q has invalid URL %q: %w", name, raw, err)
		}
	}
	return &t, nil
}

func (t *Table) Size() int { return len(t.Routes) }

func (t *Table) BackendNames() []string {
	out := make([]string, 0, len(t.Backends))
	for k := range t.Backends {
		out = append(out, k)
	}
	return out
}

// Resolve picks a backend for the given model name.
// Returns Resolved with primary URL + fallback chain.
// External backend is signaled via Resolved.External (server layer must reject).
func (t *Table) Resolve(model string) (*Resolved, error) {
	for _, r := range t.Routes {
		ok, err := match(r.Match, model)
		if err != nil {
			return nil, fmt.Errorf("bad match %q: %w", r.Match, err)
		}
		if !ok {
			continue
		}
		res := &Resolved{Model: model, Backend: r.Backend}
		if r.Backend == "external" {
			res.External = true
			return res, nil
		}
		raw, ok := t.Backends[r.Backend]
		if !ok {
			return nil, fmt.Errorf("backend %q not declared", r.Backend)
		}
		u, _ := url.Parse(raw)
		res.URL = u
		for _, fb := range r.Fallback {
			fbRaw, ok := t.Backends[fb]
			if !ok {
				// 누락은 경고 수준 — 빌드 시 lint 가 잡아야 함. 런타임에선 무시.
				continue
			}
			fbURL, _ := url.Parse(fbRaw)
			res.Fallback = append(res.Fallback, fbURL)
		}
		return res, nil
	}
	return nil, fmt.Errorf("no route matched model %q", model)
}

// match는 glob (* 만 지원) 매칭이다. shell-style filepath.Match 재사용.
func match(pattern, s string) (bool, error) {
	return filepath.Match(pattern, s)
}
