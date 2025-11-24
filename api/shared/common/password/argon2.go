package password

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

var (
	defaultMemory      uint32 = 64 * 1024
	defaultIterations  uint32 = 3
	defaultParallelism uint8  = 4
	defaultSaltLength  uint32 = 16
	defaultKeyLength   uint32 = 32
)

// Hash hashes plaintext password using Argon2id.
func Hash(password string) (string, error) {
	salt := make([]byte, defaultSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, defaultIterations, defaultMemory, defaultParallelism, defaultKeyLength)

	// Format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)
	str := fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		defaultMemory, defaultIterations, defaultParallelism, encodedSalt, encodedHash)
	return str, nil
}

// Verify compares password against encoded hash.
func Verify(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid argon2 hash format")
	}

	var memory uint32
	var iterations uint32
	var parallelism uint8

	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism)
	if err != nil {
		return false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}

	computed := argon2.IDKey([]byte(password), salt, iterations, memory, parallelism, uint32(len(hash)))

	if subtleCompare(hash, computed) {
		return true, nil
	}
	return false, nil
}

func subtleCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}
