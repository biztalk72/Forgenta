// 카탈로그 핸들러 - Agent CRUD + Clone(계보 기록). App/PromptTemplate은 동일 패턴으로 확장.
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

type Agent struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Config      json.RawMessage `json:"config"`
	Visibility  string          `json:"visibility"`
}

// 워크스페이스 컨텍스트는 게이트웨이가 주입하는 헤더에서 읽는다.
func wsID(r *http.Request) string   { return r.Header.Get("X-Workspace-Id") }
func userID(r *http.Request) string { return r.Header.Get("X-User-Id") }

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/agents", s.list)
	mux.HandleFunc("POST /v1/agents", s.create)
	mux.HandleFunc("GET /v1/agents/{id}", s.get)
	mux.HandleFunc("PUT /v1/agents/{id}", s.update)
	mux.HandleFunc("DELETE /v1/agents/{id}", s.delete)
	mux.HandleFunc("POST /v1/agents/{id}/clone", s.clone)
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	rows, err := s.Pool.Query(r.Context(),
		`SELECT id::text, workspace_id::text, name, coalesce(description,''), config, visibility
		   FROM agent WHERE workspace_id=$1 ORDER BY created_at DESC`, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []Agent{}
	for rows.Next() {
		var a Agent
		if err := rows.Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Description, &a.Config, &a.Visibility); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, a)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	var a Agent
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil || a.Name == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if len(a.Config) == 0 {
		a.Config = json.RawMessage(`{}`)
	}
	if a.Visibility == "" {
		a.Visibility = "workspace"
	}
	var id string
	err := s.Pool.QueryRow(r.Context(),
		`INSERT INTO agent (workspace_id, name, description, config, visibility, created_by)
		 VALUES ($1,$2,$3,$4,$5,nullif($6,'')::uuid) RETURNING id::text`,
		wsID(r), a.Name, a.Description, a.Config, a.Visibility, userID(r)).Scan(&id)
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	a.ID, a.WorkspaceID = id, wsID(r)
	writeJSON(w, http.StatusCreated, a)
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	var a Agent
	err := s.Pool.QueryRow(r.Context(),
		`SELECT id::text, workspace_id::text, name, coalesce(description,''), config, visibility
		   FROM agent WHERE id=$1 AND workspace_id=$2`, r.PathValue("id"), wsID(r)).
		Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Description, &a.Config, &a.Visibility)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	var a Agent
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	if len(a.Config) == 0 {
		a.Config = json.RawMessage(`{}`)
	}
	ct, err := s.Pool.Exec(r.Context(),
		`UPDATE agent SET name=$1, description=$2, config=$3, visibility=coalesce(nullif($4,''),visibility),
		        updated_at=now() WHERE id=$5 AND workspace_id=$6`,
		a.Name, a.Description, a.Config, a.Visibility, r.PathValue("id"), wsID(r))
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
	ct, err := s.Pool.Exec(r.Context(),
		`DELETE FROM agent WHERE id=$1 AND workspace_id=$2`, r.PathValue("id"), wsID(r))
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

// clone은 원본을 복제하고 clone_lineage에 계보를 기록한다.
func (s *Server) clone(w http.ResponseWriter, r *http.Request) {
	src := r.PathValue("id")
	tx, err := s.Pool.Begin(r.Context())
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "tx failed")
		return
	}
	defer tx.Rollback(r.Context())

	var target string
	var a Agent
	err = tx.QueryRow(r.Context(),
		`INSERT INTO agent (workspace_id, name, description, config, visibility, created_by)
		 SELECT workspace_id, name || ' (copy)', description, config, visibility, nullif($3,'')::uuid
		   FROM agent WHERE id=$1 AND workspace_id=$2
		 RETURNING id::text, name, coalesce(description,''), config, visibility, workspace_id::text`,
		src, wsID(r), userID(r)).
		Scan(&target, &a.Name, &a.Description, &a.Config, &a.Visibility, &a.WorkspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "source not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "clone failed")
		return
	}
	if _, err = tx.Exec(r.Context(),
		`INSERT INTO clone_lineage (workspace_id, entity_type, source_id, target_id, cloned_by)
		 VALUES ($1,'agent',$2,$3,nullif($4,'')::uuid)`,
		wsID(r), src, target, userID(r)); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "lineage failed")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "commit failed")
		return
	}
	a.ID = target
	writeJSON(w, http.StatusCreated, a)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
