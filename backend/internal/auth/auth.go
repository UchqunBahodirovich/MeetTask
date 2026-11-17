package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

type Claims struct {
	WorkspaceID string `json:"workspaceId"`
	AccessRole  string `json:"accessRole"`
	jwt.RegisteredClaims
}

type Tokens struct {
	AccessToken  string
	RefreshToken string
	RefreshID    string
	RefreshHash  []byte
	ExpiresAt    time.Time
}

type Manager struct {
	JWTSecret     []byte
	RefreshSecret []byte
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
}

func HashPassword(password string) (string, error) {
	if len(password) < 8 || len(password) > 128 {
		return "", errors.New("parol 8–128 belgidan iborat bo‘lishi kerak")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 2, 32)
	return fmt.Sprintf("$argon2id$v=19$m=65536,t=3,p=2$%s$%s",
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var memory uint32
	var iterations uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false
	}
	salt, err1 := base64.RawStdEncoding.DecodeString(parts[4])
	want, err2 := base64.RawStdEncoding.DecodeString(parts[5])
	if err1 != nil || err2 != nil {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, iterations, memory, parallelism, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}

func (m Manager) Issue(userID, workspaceID, accessRole string) (Tokens, error) {
	now := time.Now().UTC()
	access, err := m.sign(m.JWTSecret, Claims{
		WorkspaceID: workspaceID, AccessRole: accessRole,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: userID, IssuedAt: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.AccessTTL)), Issuer: "meettask",
		},
	})
	if err != nil {
		return Tokens{}, err
	}
	refreshID := uuid.NewString()
	refreshExpiry := now.Add(m.RefreshTTL)
	refresh, err := m.sign(m.RefreshSecret, Claims{WorkspaceID: workspaceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID: refreshID, Subject: userID, IssuedAt: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExpiry), Issuer: "meettask-refresh",
		},
	})
	if err != nil {
		return Tokens{}, err
	}
	hash := sha256.Sum256([]byte(refresh))
	return Tokens{AccessToken: access, RefreshToken: refresh, RefreshID: refreshID, RefreshHash: hash[:], ExpiresAt: refreshExpiry}, nil
}

func (m Manager) ParseAccess(token string) (Claims, error) {
	return m.parse(token, m.JWTSecret, "meettask")
}

func (m Manager) ParseRefresh(token string) (Claims, error) {
	return m.parse(token, m.RefreshSecret, "meettask-refresh")
}

func RefreshHash(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}

func (m Manager) sign(secret []byte, claims Claims) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func (m Manager) parse(value string, secret []byte, issuer string) (Claims, error) {
	var claims Claims
	token, err := jwt.ParseWithClaims(value, &claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("noto‘g‘ri imzo usuli")
		}
		return secret, nil
	}, jwt.WithIssuer(issuer), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || claims.Subject == "" {
		return Claims{}, errors.New("token yaroqsiz")
	}
	return claims, nil
}

func Bearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func ParsePositive(value string, fallback, maximum int) int {
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 {
		return fallback
	}
	return min(n, maximum)
}
