// 인증 핸들러 - 로그인(JWT 발급), /auth/me(클레임 조회), RBAC/워크스페이스 컨텍스트
package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/forgenta/identity-svc/internal/config"
	"github.com/forgenta/shared/httperr"
	"github.com/forgenta/shared/token"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Server struct {
	Pool *pgxpool.Pool
	Cfg  config.Config
	Log  *slog.Logger
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// Login은 이메일/비밀번호를 검증하고 워크스페이스/역할을 담은 JWT를 발급한다.
func (s *Server) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		httperr.Write(w, http.StatusBadRequest, "invalid request")
		return
	}

	var userID, hash string
	err := s.Pool.QueryRow(r.Context(),
		`SELECT id::text, password_hash FROM users WHERE email=$1 AND is_active`,
		req.Email).Scan(&userID, &hash)
	if errors.Is(err, pgx.ErrNoRows) || hash == "" {
		httperr.Write(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		s.Log.Error("login_query_failed", "err", err)
		httperr.Write(w, http.StatusInternalServerError, "internal error")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		httperr.Write(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	wsID, role := s.defaultMembership(r.Context(), userID)
	tok, err := token.Issue(s.Cfg.JWTSecret, userID, wsID, role, s.Cfg.JWTExpiry)
	if err != nil {
		s.Log.Error("token_issue_failed", "err", err)
		httperr.Write(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{
		AccessToken: tok, TokenType: "Bearer", ExpiresIn: int(s.Cfg.JWTExpiry.Seconds()),
	})
}

// Me는 Bearer 토큰을 검증하고 사용자/워크스페이스/역할을 반환한다.
func (s *Server) Me(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	claims, err := token.Parse(s.Cfg.JWTSecret, raw)
	if err != nil {
		httperr.Write(w, http.StatusUnauthorized, "invalid token")
		return
	}
	var email string
	_ = s.Pool.QueryRow(r.Context(), `SELECT email FROM users WHERE id=$1`, claims.Subject).Scan(&email)
	writeJSON(w, http.StatusOK, map[string]string{
		"user_id":      claims.Subject,
		"email":        email,
		"workspace_id": claims.WorkspaceID,
		"role":         claims.Role,
	})
}

// defaultMembership는 사용자의 첫 워크스페이스 멤버십(워크스페이스, 역할)을 반환한다.
func (s *Server) defaultMembership(ctx context.Context, userID string) (string, string) {
	var wsID, role string
	_ = s.Pool.QueryRow(ctx,
		`SELECT wm.workspace_id::text, r.name
		   FROM workspace_member wm JOIN role r ON r.id = wm.role_id
		  WHERE wm.user_id = $1
		  ORDER BY wm.created_at LIMIT 1`, userID).Scan(&wsID, &role)
	return wsID, role
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
