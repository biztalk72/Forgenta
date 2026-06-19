package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/forgenta/shared/token"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
}

func TestAuthRejectsMissingToken(t *testing.T) {
	rec := httptest.NewRecorder()
	Auth("secret", okHandler()).ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rec.Code)
	}
}

func TestAuthAcceptsValidTokenAndInjectsHeaders(t *testing.T) {
	raw, _ := token.Issue("secret", "u1", "w1", "owner", time.Hour)
	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Authorization", "Bearer "+raw)

	var gotUser string
	h := Auth("secret", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUser = r.Header.Get("X-User-Id")
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || gotUser != "u1" {
		t.Fatalf("want 200 + user u1, got %d / %q", rec.Code, gotUser)
	}
}
