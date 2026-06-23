// 워크플로우 핸들러 - Workflow CRUD + Clone(계보) + Run/Step 기록(오케스트레이션 내부 write API)
package server

import (
	"encoding/json"
	"errors"
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
	// 워크플로우 카탈로그 (게이트웨이 노출)
	mux.HandleFunc("GET /v1/workflows", s.list)
	mux.HandleFunc("POST /v1/workflows", s.create)
	mux.HandleFunc("GET /v1/workflows/{id}", s.get)
	mux.HandleFunc("PUT /v1/workflows/{id}", s.update)
	mux.HandleFunc("DELETE /v1/workflows/{id}", s.delete)
	mux.HandleFunc("POST /v1/workflows/{id}/clone", s.clone)
	mux.HandleFunc("GET /v1/workflows/{id}/runs", s.listRuns)
	mux.HandleFunc("GET /v1/runs/{id}", s.getRun)
	// 오케스트레이션 전용 내부 write API (서비스 간 호출, X-Workspace-Id 헤더 전달)
	mux.HandleFunc("POST /v1/runs", s.createRun)
	mux.HandleFunc("PATCH /v1/runs/{id}", s.patchRun)
	mux.HandleFunc("POST /v1/runs/{id}/steps", s.createStep)
	mux.HandleFunc("PATCH /v1/steps/{id}", s.patchStep)
}

type Workflow struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Spec        json.RawMessage `json:"spec"`
	Source      string          `json:"source"`
	Status      string          `json:"status"`
	Version     int             `json:"version"`
}

const wfCols = `id::text, workspace_id::text, name, coalesce(description,''), spec, source, status, version`

func scanWf(row pgx.Row) (Workflow, error) {
	var w Workflow
	err := row.Scan(&w.ID, &w.WorkspaceID, &w.Name, &w.Description, &w.Spec, &w.Source, &w.Status, &w.Version)
	return w, err
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	rows, err := s.Pool.Query(r.Context(),
		`SELECT `+wfCols+` FROM workflow WHERE workspace_id=$1 ORDER BY created_at DESC`, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []Workflow{}
	for rows.Next() {
		wf, err := scanWf(rows)
		if err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, wf)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	var wf Workflow
	if err := json.NewDecoder(r.Body).Decode(&wf); err != nil || wf.Name == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if len(wf.Spec) == 0 {
		wf.Spec = json.RawMessage(`{}`)
	}
	if wf.Source == "" {
		wf.Source = "manual"
	}
	var id string
	err := s.Pool.QueryRow(r.Context(),
		`INSERT INTO workflow (workspace_id, name, description, spec, source, created_by)
		 VALUES ($1,$2,$3,$4,$5,nullif($6,'')::uuid) RETURNING id::text`,
		wsID(r), wf.Name, wf.Description, wf.Spec, wf.Source, userID(r)).Scan(&id)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	wf.ID, wf.WorkspaceID, wf.Status, wf.Version = id, wsID(r), "draft", 1
	writeJSON(w, http.StatusCreated, wf)
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	wf, err := scanWf(s.Pool.QueryRow(r.Context(),
		`SELECT `+wfCols+` FROM workflow WHERE id=$1 AND workspace_id=$2`, r.PathValue("id"), wsID(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, wf)
}

func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	var wf Workflow
	if err := json.NewDecoder(r.Body).Decode(&wf); err != nil {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if len(wf.Spec) == 0 {
		wf.Spec = json.RawMessage(`{}`)
	}
	ct, err := s.Pool.Exec(r.Context(),
		`UPDATE workflow SET name=$1, description=$2, spec=$3,
		        status=coalesce(nullif($4,''),status), version=version+1, updated_at=now()
		  WHERE id=$5 AND workspace_id=$6`,
		wf.Name, wf.Description, wf.Spec, wf.Status, r.PathValue("id"), wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "update failed")
		return
	}
	if ct.RowsAffected() == 0 {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) delete(w http.ResponseWriter, r *http.Request) {
	ct, err := s.Pool.Exec(r.Context(), `DELETE FROM workflow WHERE id=$1 AND workspace_id=$2`, r.PathValue("id"), wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "delete failed")
		return
	}
	if ct.RowsAffected() == 0 {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// clone은 워크플로우를 복제하고 clone_lineage(entity_type='workflow')에 계보를 기록한다.
func (s *Server) clone(w http.ResponseWriter, r *http.Request) {
	src := r.PathValue("id")
	tx, err := s.Pool.Begin(r.Context())
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback(r.Context())
	var target string
	wf, err := scanWf(tx.QueryRow(r.Context(),
		`INSERT INTO workflow (workspace_id, name, description, spec, source, created_by)
		 SELECT workspace_id, name || ' (copy)', description, spec, source, nullif($3,'')::uuid
		   FROM workflow WHERE id=$1 AND workspace_id=$2
		 RETURNING `+wfCols, src, wsID(r), userID(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "source not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "clone failed")
		return
	}
	target = wf.ID
	if _, err = tx.Exec(r.Context(),
		`INSERT INTO clone_lineage (workspace_id, entity_type, source_id, target_id, cloned_by)
		 VALUES ($1,'workflow',$2,$3,nullif($4,'')::uuid)`, wsID(r), src, target, userID(r)); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "lineage failed")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "commit failed")
		return
	}
	writeJSON(w, http.StatusCreated, wf)
}

func (s *Server) listRuns(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT id::text, status, trigger, coalesce(summary,''), started_at, finished_at
		   FROM workflow_run WHERE workflow_id=$1 AND workspace_id=$2 ORDER BY started_at DESC`,
		r.PathValue("id"), wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, status, trig, summary string
		var started any
		var finished any
		if err := rows.Scan(&id, &status, &trig, &summary, &started, &finished); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, map[string]any{"id": id, "status": status, "trigger": trig, "summary": summary, "started_at": started, "finished_at": finished})
	}
	writeJSON(w, http.StatusOK, out)
}

// getRun은 런 상세 + 스텝 타임라인을 반환한다. workflow_id 와 step.approval_id 는
// resume 경로(Phase 14)에서 orchestration 이 spec/blackboard/approval 결정을 끌어오는 데 필요.
func (s *Server) getRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("id")
	var status, trig, summary, workflowID string
	var ctx json.RawMessage
	err := s.Pool.QueryRow(r.Context(),
		`SELECT workflow_id::text, status, trigger, coalesce(summary,''), context
		   FROM workflow_run WHERE id=$1 AND workspace_id=$2`,
		runID, wsID(r)).Scan(&workflowID, &status, &trig, &summary, &ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	rows, _ := s.Pool.Query(r.Context(),
		`SELECT id::text, step_seq, kind, status, coalesce(error,''),
		        coalesce(approval_id::text,''),
		        prompt_tokens, completion_tokens, latency_ms
		   FROM workflow_step_run WHERE run_id=$1 ORDER BY step_seq`, runID)
	defer rows.Close()
	steps := []map[string]any{}
	for rows.Next() {
		var id, kind, st, errMsg, approvalID string
		var seq, pt, ctk, lat int
		_ = rows.Scan(&id, &seq, &kind, &st, &errMsg, &approvalID, &pt, &ctk, &lat)
		steps = append(steps, map[string]any{
			"id": id, "step_seq": seq, "kind": kind, "status": st,
			"error": errMsg, "approval_id": approvalID,
			"prompt_tokens": pt, "completion_tokens": ctk, "latency_ms": lat,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": runID, "workflow_id": workflowID,
		"status": status, "trigger": trig, "summary": summary,
		"context": ctx, "steps": steps,
	})
}

// ── 내부 write API (orchestration runtime, Phase 13에서 사용) ──

func (s *Server) createRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WorkflowID string `json:"workflow_id"`
		Trigger    string `json:"trigger"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.WorkflowID == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if body.Trigger == "" {
		body.Trigger = "manual"
	}
	var id string
	err := s.Pool.QueryRow(r.Context(),
		`INSERT INTO workflow_run (workflow_id, workspace_id, trigger) VALUES ($1,$2,$3) RETURNING id::text`,
		body.WorkflowID, wsID(r), body.Trigger).Scan(&id)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "running"})
}

func (s *Server) patchRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status   string          `json:"status"`
		Summary  string          `json:"summary"`
		Context  json.RawMessage `json:"context"`
		Finished bool            `json:"finished"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	ct, err := s.Pool.Exec(r.Context(),
		`UPDATE workflow_run SET
		    status=coalesce(nullif($1,''),status),
		    summary=coalesce(nullif($2,''),summary),
		    context=coalesce($3,context),
		    finished_at=CASE WHEN $4 THEN now() ELSE finished_at END
		  WHERE id=$5 AND workspace_id=$6`,
		body.Status, body.Summary, body.Context, body.Finished, r.PathValue("id"), wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "update failed")
		return
	}
	if ct.RowsAffected() == 0 {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) createStep(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StepSeq int             `json:"step_seq"`
		Kind    string          `json:"kind"`
		AgentID string          `json:"agent_id"`
		Status  string          `json:"status"`
		Input   json.RawMessage `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Kind == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if body.Status == "" {
		body.Status = "running"
	}
	if len(body.Input) == 0 {
		body.Input = json.RawMessage(`{}`)
	}
	var id string
	err := s.Pool.QueryRow(r.Context(),
		`INSERT INTO workflow_step_run (run_id, step_seq, kind, agent_id, status, input)
		 VALUES ($1,$2,$3,nullif($4,'')::uuid,$5,$6) RETURNING id::text`,
		r.PathValue("id"), body.StepSeq, body.Kind, body.AgentID, body.Status, body.Input).Scan(&id)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *Server) patchStep(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status           string `json:"status"`
		Error            string `json:"error"`
		OutputArtifactID string `json:"output_artifact_id"`
		ApprovalID       string `json:"approval_id"`
		PromptTokens     int    `json:"prompt_tokens"`
		CompletionTokens int    `json:"completion_tokens"`
		LatencyMs        int    `json:"latency_ms"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	ct, err := s.Pool.Exec(r.Context(),
		`UPDATE workflow_step_run SET
		    status=coalesce(nullif($1,''),status),
		    error=coalesce(nullif($2,''),error),
		    output_artifact_id=coalesce(nullif($3,'')::uuid, output_artifact_id),
		    approval_id=coalesce(nullif($4,'')::uuid, approval_id),
		    prompt_tokens=$5, completion_tokens=$6, latency_ms=$7
		  WHERE id=$8`,
		body.Status, body.Error, body.OutputArtifactID, body.ApprovalID,
		body.PromptTokens, body.CompletionTokens, body.LatencyMs, r.PathValue("id"))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "update failed")
		return
	}
	if ct.RowsAffected() == 0 {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
