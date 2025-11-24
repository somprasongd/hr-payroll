package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenService struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

type Claims struct {
	UserID   uuid.UUID `json:"uid"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	jwt.RegisteredClaims
}

func NewTokenService(accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *TokenService {
	return &TokenService{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

func (s *TokenService) GenerateAccessToken(userID uuid.UUID, username, role string) (string, time.Time, error) {
	exp := time.Now().Add(s.accessTTL)
	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.accessSecret)
	return signed, exp, err
}

func (s *TokenService) GenerateRefreshToken(userID uuid.UUID, username, role string) (string, time.Time, error) {
	exp := time.Now().Add(s.refreshTTL)
	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.refreshSecret)
	return signed, exp, err
}

func (s *TokenService) ParseAccessToken(tokenString string) (*Claims, error) {
	return parseToken(tokenString, s.accessSecret)
}

func (s *TokenService) ParseRefreshToken(tokenString string) (*Claims, error) {
	return parseToken(tokenString, s.refreshSecret)
}

func parseToken(tokenString string, secret []byte) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func (s *TokenService) AccessTTL() time.Duration {
	return s.accessTTL
}

func (s *TokenService) RefreshTTL() time.Duration {
	return s.refreshTTL
}
