// 아티팩트 핸들러 - 멀티모달 OutputArtifact 저장/조회 (MinIO 오브젝트 + Postgres 메타데이터)
package server

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/forgenta/shared/httperr"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
)

type Server struct {
	Pool   *pgxpool.Pool
	Minio  *minio.Client
	Bucket string
}

type createRequest struct {
	Type     string `json:"type"`
	MimeType string `json:"mime_type"`
	AgentID  string `json:"agent_id"`
	Content  string `json:"content"`
}

func wsID(r *http.Request) string   { return r.Header.Get("X-Workspace-Id") }
func userID(r *http.Request) string { return r.Header.Get("X-User-Id") }

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/artifacts", s.create)
	mux.HandleFunc("GET /v1/artifacts", s.list)
	mux.HandleFunc("GET /v1/artifacts/{id}", s.get)
	mux.HandleFunc("GET /v1/artifacts/{id}/content", s.content)
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	if wsID(r) == "" {
		httperr.Write(w, http.StatusBadRequest, "missing workspace context")
		return
	}
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Type == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}
	key := storageKey(wsID(r))
	data := []byte(req.Content)
	mime := req.MimeType
	if mime == "" {
		mime = "application/octet-stream"
	}
	if _, err := s.Minio.PutObject(r.Context(), s.Bucket, key, bytes.NewReader(data),
		int64(len(data)), minio.PutObjectOptions{ContentType: mime}); err != nil {
		httperr.Write(w, http.StatusInternalServerError, "storage put failed")
		return
	}
	var id string
	err := s.Pool.QueryRow(r.Context(),
		`INSERT INTO artifact (workspace_id, agent_id, type, mime_type, storage_key, created_by)
		 VALUES ($1, nullif($2,'')::uuid, $3, $4, $5, nullif($6,'')::uuid) RETURNING id::text`,
		wsID(r), req.AgentID, req.Type, mime, key, userID(r)).Scan(&id)
	if err != nil {
		_ = s.Minio.RemoveObject(r.Context(), s.Bucket, key, minio.RemoveObjectOptions{})
		httperr.Write(w, http.StatusInternalServerError, "insert failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"id": id, "type": req.Type, "mime_type": mime, "storage_key": key,
	})
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT id::text, type, mime_type, storage_key FROM artifact
		  WHERE workspace_id=$1 ORDER BY created_at DESC`, wsID(r))
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var id, typ, mime, key string
		if err := rows.Scan(&id, &typ, &mime, &key); err != nil {
			httperr.Write(w, http.StatusInternalServerError, "scan failed")
			return
		}
		out = append(out, map[string]string{"id": id, "type": typ, "mime_type": mime, "storage_key": key})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	var typ, mime, key string
	err := s.Pool.QueryRow(r.Context(),
		`SELECT type, mime_type, storage_key FROM artifact WHERE id=$1 AND workspace_id=$2`,
		r.PathValue("id"), wsID(r)).Scan(&typ, &mime, &key)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"id": r.PathValue("id"), "type": typ, "mime_type": mime, "storage_key": key,
	})
}

func (s *Server) content(w http.ResponseWriter, r *http.Request) {
	var mime, key string
	err := s.Pool.QueryRow(r.Context(),
		`SELECT mime_type, storage_key FROM artifact WHERE id=$1 AND workspace_id=$2`,
		r.PathValue("id"), wsID(r)).Scan(&mime, &key)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Write(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "query failed")
		return
	}
	obj, err := s.Minio.GetObject(r.Context(), s.Bucket, key, minio.GetObjectOptions{})
	if err != nil {
		httperr.Write(w, http.StatusInternalServerError, "storage get failed")
		return
	}
	defer obj.Close()
	w.Header().Set("Content-Type", mime)
	_, _ = io.Copy(w, obj)
}

func storageKey(ws string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return ws + "/" + hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
