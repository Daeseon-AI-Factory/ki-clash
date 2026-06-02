package main

// JWT verification — must match Python's auth/jwt_handler.py settings:
//   algorithm: HS256
//   secret:    JWT_SECRET_KEY env var (SAME across Python + Go)
//   sub:       player_id (UUID string)
//   type:      "access" (we reject refresh tokens)

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	PlayerID string `json:"sub"`
	Type     string `json:"type"`
	jwt.RegisteredClaims
}

func verifyAccessToken(token, secret string) (string, error) {
	if token == "" {
		return "", errors.New("missing token")
	}
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", fmt.Errorf("token parse: %w", err)
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return "", errors.New("invalid claims")
	}
	if claims.Type != "access" {
		return "", fmt.Errorf("expected access token, got %q", claims.Type)
	}
	if claims.PlayerID == "" {
		return "", errors.New("token missing sub claim")
	}
	return claims.PlayerID, nil
}
