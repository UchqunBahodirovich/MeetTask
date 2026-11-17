package auth

import (
	"testing"
	"time"
)

func TestPasswordHash(t *testing.T) {
	hash, err := HashPassword("strong-password")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(hash, "strong-password") || VerifyPassword(hash, "wrong-password") {
		t.Fatal("argon2id verification failed")
	}
}

func TestAccessAndRefreshUseDifferentSecrets(t *testing.T) {
	manager := Manager{JWTSecret: []byte("12345678901234567890123456789012"), RefreshSecret: []byte("abcdefghijklmnopqrstuvxyz1234567"), AccessTTL: time.Minute, RefreshTTL: time.Hour}
	tokens, err := manager.Issue("user", "workspace", "owner")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := manager.ParseAccess(tokens.AccessToken)
	if err != nil || claims.WorkspaceID != "workspace" || claims.AccessRole != "owner" {
		t.Fatalf("bad access claims: %#v, %v", claims, err)
	}
	if _, err := manager.ParseAccess(tokens.RefreshToken); err == nil {
		t.Fatal("refresh token accepted as access token")
	}
}
