// 거버넌스/계량 핸들러 - UsageEvent 수집/집계, 승인 큐, 감사 로그 (PRD v2 §2.3 [7])
package server

import (
	"encoding/json"
	"net/http"

	"github.com/forgenta/shared/httperr"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	Pool *pgxpool.Pool
}

func wsID(r *http.Request) string   { return r.Header.Get("X-Workspace-Id") }
func userID(r *http.Request) string { return r.Header.Get("X-User-Id") }

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/usage", s.ingestUsage)
	mux.HandleFunc("GET /v1/usage/summary", s.usageSummary)
	mux.HandleFunc("GET /v1/usage/by-agent", s.usageByAgent)
	mux.HandleFunc("POST /v1/approvals", s.createApproval)
	mux.HandleFunc("GET /v1/approvals", s.listApprovals)
	mux.HandleFunc("POST /v1/approvals/{id}/decide", s.decideApproval)
	mux.HandleFunc("GET /v1/audit", s.listAudit)
}

type usageEvent struct {
	AgentID          string `json:"agent_id"`
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	OriginalTokens   int    `json:"original_tokens"`
	CompressedTokens int    `json:"compressed_tokens"`
	LatencyMs        int    `json:"latency_ms"`
	Success          bool   `json:"success"`
}

func (s *Server) ingestUsage(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	var e usageEvent
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := s.Pool.Exec(r.Context(),
		`INSERT INTO usage_event
		   (workspace_id, user_id, agent_id, provider, model, prompt_tokens,
		    completion_tokens, original_tokens, compressed_tokens, latency_ms, success)
		 VALUES ($1, nullif($2,'')::uuid, nullif($3,'')::uuid, $4,$5,$6,$7,$8,$9,$10,$11)`,
		wsID(r), userID(r), e.AgentID, e.Provider, e.Model, e.PromptTokens,
		e.CompletionTokens, e.OriginalTokens, e.CompressedTokens, e.LatencyMs, e.Success)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "recorded"})
}

func (s *Server) usageSummary(w http.ResponseWriter, r *http.Request) {
	var events int
	var prompt, completion, saved int64
	err := s.Pool.QueryRow(r.Context(),
		`SELECT count(*), coalesce(sum(prompt_tokens),0), coalesce(sum(completion_tokens),0),
		        coalesce(sum(original_tokens - compressed_tokens),0)
		   FROM usage_event WHERE workspace_id=$1`, wsID(r)).
		Scan(&events, &prompt, &completion, &saved)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"events": events, "prompt_tokens": prompt, "completion_tokens": completion,
		"tokens_saved": saved,
	})
}

// usageByAgent은 usage_event를 agent별로 집계한다 (agent_id 없거나 삭제된 경우 '(general)').
func (s *Server) usageByAgent(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT coalesce(a.name, '(general)') AS agent,
		        count(*) AS events,
		        coalesce(sum(ue.prompt_tokens),0),
		        coalesce(sum(ue.completion_tokens),0),
		        coalesce(sum(ue.original_tokens - ue.compressed_tokens),0)
		   FROM usage_event ue
		   LEFT JOIN agent a ON a.id = ue.agent_id
		  WHERE ue.workspace_id = $1
		  GROUP BY a.name
		  ORDER BY events DESC`, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var agent string
		var events int
		var prompt, completion, saved int64
		if err := rows.Scan(&agent, &events, &prompt, &completion, &saved); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, map[string]any{
			"agent": agent, "events": events,
			"prompt_tokens": prompt, "completion_tokens": completion, "tokens_saved": saved,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

type approvalReq struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
}

func (s *Server) createApproval(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	var req approvalReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ResourceType == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	tx, err := s.Pool.Begin(r.Context())
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO approval (workspace_id, requested_by, resource_type, resource_id)
		 VALUES ($1, nullif($2,'')::uuid, $3, nullif($4,'')::uuid) RETURNING id::text`,
		wsID(r), userID(r), req.ResourceType, req.ResourceID).Scan(&id)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	s.audit(r, tx, "approval.requested", "approval", id)
	if err := tx.Commit(r.Context()); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "commit failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "pending"})
}

func (s *Server) listApprovals(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	rows, err := s.Pool.Query(r.Context(),
		`SELECT id::text, resource_type, coalesce(resource_id::text,''), status
		   FROM approval WHERE workspace_id=$1 AND status=$2 ORDER BY created_at DESC`,
		wsID(r), status)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var id, rt, rid, st string
		if err := rows.Scan(&id, &rt, &rid, &st); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, map[string]string{"id": id, "resource_type": rt, "resource_id": rid, "status": st})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) decideApproval(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Decision string `json:"decision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil ||
		(body.Decision != "approved" && body.Decision != "rejected") {
		httperr.Write(w, http.StatusBadRequest, "decision must be approved|rejected")
		return
	}
	id := r.PathValue("id")
	tx, err := s.Pool.Begin(r.Context())
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback(r.Context())
	ct, err := tx.Exec(r.Context(),
		`UPDATE approval SET status=$1, decided_by=nullif($2,'')::uuid, decided_at=now()
		  WHERE id=$3 AND workspace_id=$4 AND status='pending'`,
		body.Decision, userID(r), id, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "update failed")
		return
	}
	if ct.RowsAffected() == 0 {
		httperr.Write(w, http.StatusNotFound, "not found or already decided")
		return
	}
	s.audit(r, tx, "approval."+body.Decision, "approval", id)
	if err := tx.Commit(r.Context()); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "commit failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": body.Decision})
}

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT action, coalesce(target_type,''), coalesce(target_id::text,'')
		   FROM audit_log WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50`, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var action, tt, tid string
		if err := rows.Scan(&action, &tt, &tid); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, map[string]string{"action": action, "target_type": tt, "target_id": tid})
	}
	writeJSON(w, http.StatusOK, out)
}

// audit는 트랜잭션 내에서 감사 로그를 기록한다.
func (s *Server) audit(r *http.Request, tx pgx.Tx, action, targetType, targetID string) {
	_, _ = tx.Exec(r.Context(),
		`INSERT INTO audit_log (workspace_id, actor_id, action, target_type, target_id)
		 VALUES ($1, nullif($2,'')::uuid, $3, $4, nullif($5,'')::uuid)`,
		wsID(r), userID(r), action, targetType, targetID)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
