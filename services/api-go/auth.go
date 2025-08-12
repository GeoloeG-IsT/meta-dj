package main

import (
	"net/http"
	"os"
	"strings"
	"time"

	keyfunc "github.com/MicahParks/keyfunc"
	jwt "github.com/golang-jwt/jwt/v4"
)

var (
	jwks *keyfunc.JWKS
)

// maybeJWT enforces Bearer JWT validation if JWT_SECRET is set or SUPABASE_JWKS_URL is configured.
func maybeJWT(next http.Handler) http.Handler {
	secret := os.Getenv("JWT_SECRET")
	jwksURL := os.Getenv("SUPABASE_JWKS_URL")
	if jwks == nil && jwksURL != "" {
		// initialize JWKS (with refresh)
		options := keyfunc.Options{RefreshInterval: time.Hour}
		if jw, err := keyfunc.Get(jwksURL, options); err == nil {
			jwks = jw
		}
	}
	if secret == "" && jwks == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimSpace(auth[len("Bearer "):])
		var parser jwt.Parser
		var claims jwt.MapClaims
		var err error
		if jwks != nil {
			_, err = parser.ParseWithClaims(tokenStr, jwt.MapClaims{}, jwks.Keyfunc)
		} else {
			_, err = parser.ParseWithClaims(tokenStr, jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrTokenUnverifiable
				}
				return []byte(secret), nil
			})
		}
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = claims // reserved for future user context extraction
		next.ServeHTTP(w, r)
	})
}
