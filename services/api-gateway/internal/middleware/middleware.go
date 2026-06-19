// 게이트웨이 미들웨어 - Rate Limiting(IP별)과 Auth Check(JWT 검증 + 컨텍스트 주입)
package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/forgenta/shared/httperr"
	"github.com/forgenta/shared/token"
	"golang.org/x/time/rate"
)

// RateLimit은 클라이언트 IP별 토큰버킷으로 요청을 제한한다.
func RateLimit(rps float64, burst int, next http.Handler) http.Handler {
	var mu sync.Mutex
	limiters := make(map[string]*rate.Limiter)

	get := func(ip string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()
		l, ok := limiters[ip]
		if !ok {
			l = rate.NewLimiter(rate.Limit(rps), burst)
			limiters[ip] = l
		}
		return l
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		if !get(ip).Allow() {
			httperr.Write(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Auth는 Bearer JWT를 검증하고 다운스트림에 사용자/워크스페이스/역할 헤더를 주입한다.
func Auth(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims, err := token.Parse(secret, raw)
		if err != nil {
			httperr.Write(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		r.Header.Set("X-User-Id", claims.Subject)
		r.Header.Set("X-Workspace-Id", claims.WorkspaceID)
		r.Header.Set("X-Role", claims.Role)
		next.ServeHTTP(w, r)
	})
}
