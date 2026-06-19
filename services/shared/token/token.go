// JWT 발급/검증 (HS256) - identity-svc는 발급, api-gateway는 검증에 공용 사용
package token

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims는 워크스페이스 컨텍스트와 역할을 담는 JWT 클레임이다.
type Claims struct {
	WorkspaceID string `json:"wsid"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

// Issue는 사용자/워크스페이스/역할로 서명된 토큰을 발급한다.
func Issue(secret, userID, workspaceID, role string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		WorkspaceID: workspaceID,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// Parse는 서명/만료를 검증하고 클레임을 반환한다.
func Parse(secret, raw string) (*Claims, error) {
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !tok.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
