package token

import (
	"testing"
	"time"
)

func TestRoundTrip(t *testing.T) {
	raw, err := Issue("secret", "user-1", "ws-1", "owner", time.Hour)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	c, err := Parse("secret", raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if c.Subject != "user-1" || c.WorkspaceID != "ws-1" || c.Role != "owner" {
		t.Fatalf("unexpected claims: %+v", c)
	}
}

func TestWrongSecret(t *testing.T) {
	raw, _ := Issue("secret", "u", "w", "r", time.Hour)
	if _, err := Parse("other", raw); err == nil {
		t.Fatal("expected error for wrong secret")
	}
}

func TestExpired(t *testing.T) {
	raw, _ := Issue("secret", "u", "w", "r", -time.Minute)
	if _, err := Parse("secret", raw); err == nil {
		t.Fatal("expected error for expired token")
	}
}
