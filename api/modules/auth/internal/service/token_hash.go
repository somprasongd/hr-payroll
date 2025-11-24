package service

import (
	"crypto/sha256"
	"encoding/base64"
)

func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawStdEncoding.EncodeToString(sum[:])
}
