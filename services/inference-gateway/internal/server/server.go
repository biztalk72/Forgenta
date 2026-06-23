// HTTP 서버 — OpenAI 호환 엔드포인트 라우팅 + sensitive 가드 + 메트릭.
package server

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/forgenta/inference-gateway/internal/metrics"
	"github.com/forgenta/inference-gateway/internal/proxy"
	"github.com/forgenta/inference-gateway/internal/router"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/httperr"
)

type Options struct {
	Version string
	Router  *router.Table
	Log     *slog.Logger
}

type Server struct {
	mux *http.ServeMux
	opt Options
}

func New(opt Options) *Server {
	s := &Server{
		mux: http.NewServeMux(),
		opt: opt,
	}
	health.Handler{Service: "inference-gateway", Version: opt.Version}.Register(s.mux)
	s.mux.Handle("GET /metrics", metrics.Handler())
	s.mux.HandleFunc("GET /v1/models", s.listModels)
	s.mux.HandleFunc("POST /v1/chat/completions", s.route)
	s.mux.HandleFunc("POST /v1/completions", s.route)
	s.mux.HandleFunc("POST /v1/embeddings", s.route)
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.mux.ServeHTTP(w, r) }

type modelReq struct {
	Model string `json:"model"`
}

// route 는 body 의 model 필드를 보고 routing table 을 적용해 백엔드로 프록시한다.
// sensitive 헤더가 true 이면 external 백엔드 차단 (403).
func (s *Server) route(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// body 캡처 (fallback 재시도에 필요).
	capt, err := proxy.Capture(r)
	if err != nil {
		httperr.Write(w, http.StatusBadRequest, "read body")
		return
	}

	// model 필드 파싱 — embed/chat/completions 모두 body 에 "model" 키를 가진다.
	var mr modelReq
	if err := json.NewDecoder(bytes.NewReader(capt.Body)).Decode(&mr); err != nil || mr.Model == "" {
		httperr.Write(w, http.StatusBadRequest, "missing model field")
		return
	}

	sensitive := strings.EqualFold(r.Header.Get("X-Forgenta-Sensitive"), "true")

	res, err := s.opt.Router.Resolve(mr.Model)
	if err != nil {
		s.opt.Log.Warn("route_unmatched", "model", mr.Model, "err", err)
		httperr.Write(w, http.StatusNotFound, "no route for model")
		metrics.IncRequest("unknown", mr.Model, "404")
		return
	}

	metrics.IncRouteDecision(mr.Model, res.Backend)

	if res.External {
		// PRD v3.4 §10: 민감 데이터는 external 차단. 비민감이라도 ig 는 external 을 직접 호출하지 않는다 (정책).
		// orchestration-svc 가 external (Claude/GPT 등) 을 직접 호출해야 한다.
		s.opt.Log.Info("route_external_rejected", "model", mr.Model, "sensitive", sensitive)
		httperr.Write(w, http.StatusForbidden, "external backend not routable via inference-gateway")
		metrics.IncRequest("external", mr.Model, "403")
		return
	}

	if sensitive {
		// Backend allowlist 는 vllm/nim/ollama 만 허용 (host 명에 prefix 매칭).
		host := res.URL.Host
		if !isLocalBackend(host) {
			s.opt.Log.Warn("sensitive_blocked", "model", mr.Model, "backend", res.Backend)
			httperr.Write(w, http.StatusForbidden, "sensitive request blocked for backend")
			metrics.IncRequest(res.Backend, mr.Model, "403")
			return
		}
	}

	// 1차 시도 — 1차는 model 명 그대로 (rewrite 없음).
	upErr := proxy.Serve(w, r, capt, res.URL, s.opt.Log, "")
	dur := time.Since(start).Seconds()
	metrics.ObserveDuration(res.Backend, mr.Model, dur)
	if upErr == nil {
		metrics.IncRequest(res.Backend, mr.Model, "200")
		return
	}

	// Fallback 체인 — 5xx 또는 connect failure 시 시도.
	// 단, 1차 응답 헤더가 이미 클라이언트로 flush 되었다면 fallback 불가 (SSE 도중 backend 가 죽은 경우).
	// httputil.ReverseProxy 는 헤더 flush 전에 ErrorHandler 가 호출되면 본문이 안 나갔다고 가정.
	if !proxy.IsUpstreamFailure(upErr) {
		s.opt.Log.Error("proxy_terminal", "err", upErr)
		return
	}
	for _, fb := range res.Fallback {
		s.opt.Log.Warn("fallback_attempt", "primary", res.Backend, "fallback", fb.URL.Host, "rewrite_model", fb.RewriteModel)
		metrics.IncFallback(res.Backend, fb.URL.Host)
		if err := proxy.Serve(w, r, capt, fb.URL, s.opt.Log, fb.RewriteModel); err == nil {
			metrics.IncRequest(fb.URL.Host, mr.Model, "200_fallback")
			return
		}
	}
	s.opt.Log.Error("all_backends_failed", "model", mr.Model, "primary", res.Backend)
	httperr.Write(w, http.StatusBadGateway, "all backends failed")
	metrics.IncRequest(res.Backend, mr.Model, "502")
}

// listModels 는 모든 vLLM 백엔드의 /v1/models 를 aggregate. 가벼운 best-effort.
func (s *Server) listModels(w http.ResponseWriter, r *http.Request) {
	type modelObj struct {
		ID      string `json:"id"`
		Object  string `json:"object"`
		OwnedBy string `json:"owned_by"`
	}
	type modelList struct {
		Object string     `json:"object"`
		Data   []modelObj `json:"data"`
	}
	agg := modelList{Object: "list"}
	seen := make(map[string]bool)
	client := &http.Client{Timeout: 3 * time.Second}
	for _, name := range s.opt.Router.BackendNames() {
		raw, ok := s.opt.Router.Backends[name]
		if !ok {
			continue
		}
		resp, err := client.Get(raw + "/v1/models")
		if err != nil || resp.StatusCode != 200 {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}
		var ml modelList
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		_ = json.Unmarshal(body, &ml)
		for _, m := range ml.Data {
			if seen[m.ID] {
				continue
			}
			seen[m.ID] = true
			if m.OwnedBy == "" {
				m.OwnedBy = name
			}
			agg.Data = append(agg.Data, m)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(agg)
}

// 로컬 백엔드 호스트 판정 — sensitive 요청은 forgenta-llm 네임스페이스 안의 서비스만 허용.
func isLocalBackend(host string) bool {
	return strings.HasSuffix(host, ".forgenta-llm:8000") ||
		strings.HasSuffix(host, ".forgenta-llm:11434") ||
		strings.HasPrefix(host, "vllm-") ||
		strings.HasPrefix(host, "ollama") ||
		strings.HasPrefix(host, "nim-")
}
