// 헬스 체크 핸들러 (CLAUDE.md §6 규격) - GET /health(liveness), GET /health/ready(readiness)
package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// Check는 readiness 의존성 검사 함수다. nil이면 정상.
type Check func(context.Context) error

type Handler struct {
	Service string
	Version string
	Checks  map[string]Check // readiness에서 평가할 의존성들
}

type response struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Service   string            `json:"service"`
	Version   string            `json:"version"`
	Checks    map[string]string `json:"checks,omitempty"`
}

func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.live)
	mux.HandleFunc("GET /health/ready", h.ready)
}

func (h Handler) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, response{
		Status: "ok", Timestamp: now(), Service: h.Service, Version: h.Version,
	})
}

func (h Handler) ready(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]string, len(h.Checks))
	status, code := "ok", http.StatusOK
	for name, c := range h.Checks {
		if err := c(r.Context()); err != nil {
			checks[name] = "unhealthy"
			status, code = "unhealthy", http.StatusServiceUnavailable
		} else {
			checks[name] = "ok"
		}
	}
	writeJSON(w, code, response{
		Status: status, Timestamp: now(), Service: h.Service, Version: h.Version, Checks: checks,
	})
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
