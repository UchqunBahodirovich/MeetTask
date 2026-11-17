package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               string
	GoogleCloudProject string
	JWTSecret          string
	RefreshSecret      string
	SonioxAPIKey       string
	OpenAIAPIKey       string
	OpenAIModel        string
	AnalyzeChunkChars  int
	CORSOrigins        map[string]struct{}
	CookieSecure       bool
	AllowLegacyAPI     bool
	AccessTTL          time.Duration
	RefreshTTL         time.Duration
}

func Load() (Config, error) {
	c := Config{
		Port:               env("PORT", "3001"),
		GoogleCloudProject: os.Getenv("GOOGLE_CLOUD_PROJECT"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		RefreshSecret:      os.Getenv("REFRESH_SECRET"),
		SonioxAPIKey:       os.Getenv("SONIOX_API_KEY"),
		OpenAIAPIKey:       os.Getenv("OPENAI_API_KEY"),
		OpenAIModel:        env("OPENAI_MODEL", "gpt-5-nano"),
		AnalyzeChunkChars:  envInt("ANALYZE_CHUNK_CHARS", 12000),
		CORSOrigins:        csvSet(os.Getenv("CORS_ORIGINS")),
		CookieSecure:       env("COOKIE_SECURE", "true") != "false",
		AllowLegacyAPI:     env("ALLOW_LEGACY_API", "false") == "true",
		AccessTTL:          15 * time.Minute,
		RefreshTTL:         30 * 24 * time.Hour,
	}
	if c.GoogleCloudProject == "" || c.JWTSecret == "" || c.RefreshSecret == "" {
		return Config{}, errors.New("GOOGLE_CLOUD_PROJECT, JWT_SECRET va REFRESH_SECRET majburiy")
	}
	if len(c.JWTSecret) < 32 || len(c.RefreshSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET va REFRESH_SECRET kamida 32 belgidan iborat bo‘lishi kerak")
	}
	if c.AnalyzeChunkChars < 2000 {
		c.AnalyzeChunkChars = 2000
	}
	return c, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func csvSet(value string) map[string]struct{} {
	result := make(map[string]struct{})
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			result[item] = struct{}{}
		}
	}
	return result
}
