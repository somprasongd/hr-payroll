# shared-password

Password hashing and verification using Argon2id.

## Why Argon2id

- **Winner of Password Hashing Competition (2015)**
- Resistant to GPU/ASIC attacks
- Memory-hard function (slows down brute force)
- Recommended by OWASP

## File: api/shared/common/password/argon2.go

```go
package password

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "errors"
    "fmt"
    "strings"

    "golang.org/x/crypto/argon2"
)

var (
    defaultMemory      uint32 = 64 * 1024  // 64 MB
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

    hash := argon2.IDKey(
        []byte(password),
        salt,
        defaultIterations,
        defaultMemory,
        defaultParallelism,
        defaultKeyLength,
    )

    // Format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
    encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
    encodedHash := base64.RawStdEncoding.EncodeToString(hash)
    
    return fmt.Sprintf(
        "$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
        defaultMemory, defaultIterations, defaultParallelism,
        encodedSalt, encodedHash,
    ), nil
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

    computed := argon2.IDKey(
        []byte(password),
        salt,
        iterations,
        memory,
        parallelism,
        uint32(len(hash)),
    )

    return subtleConstantTimeCompare(hash, computed), nil
}

// subtleConstantTimeCompare prevents timing attacks.
func subtleConstantTimeCompare(a, b []byte) bool {
    if len(a) != len(b) {
        return false
    }
    var result byte
    for i := 0; i < len(a); i++ {
        result |= a[i] ^ b[i]
    }
    return result == 0
}
```

## Usage

### Hash Password (Registration)

```go
package create

import (
    "{project}/api/shared/common/password"
)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    // Hash password before storing
    hashedPassword, err := password.Hash(cmd.Password)
    if err != nil {
        return nil, errs.Internal("failed to hash password")
    }

    user, err := h.repo.Create(ctx, cmd.Email, hashedPassword)
    // ...
}
```

### Verify Password (Login)

```go
package login

import (
    "{project}/api/shared/common/password"
    "{project}/api/shared/common/errs"
)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    user, err := h.repo.GetByEmail(ctx, cmd.Email)
    if err != nil {
        // Don't reveal if email exists
        return nil, errs.Unauthorized("invalid credentials")
    }

    valid, err := password.Verify(cmd.Password, user.PasswordHash)
    if err != nil || !valid {
        return nil, errs.Unauthorized("invalid credentials")
    }

    // Generate tokens...
}
```

## Password Requirements

แนะนำให้ validate password ก่อน hash:

```go
func validatePassword(p string) error {
    if len(p) < 8 {
        return errs.BadRequest("password must be at least 8 characters")
    }
    
    var (
        hasUpper   bool
        hasLower   bool
        hasNumber  bool
        hasSpecial bool
    )
    
    for _, c := range p {
        switch {
        case c >= 'A' && c <= 'Z':
            hasUpper = true
        case c >= 'a' && c <= 'z':
            hasLower = true
        case c >= '0' && c <= '9':
            hasNumber = true
        default:
            hasSpecial = true
        }
    }
    
    if !hasUpper || !hasLower || !hasNumber {
        return errs.BadRequest("password must contain uppercase, lowercase, and number")
    }
    
    return nil
}
```

## Security Considerations

### ✅ Do
- Hash **before** storing in database
- Use constant-time comparison (`subtle.ConstantTimeCompare`)
- Validate password strength client-side และ server-side
- Return generic error messages ("invalid credentials")

### ❌ Don't
- Store plaintext passwords
- Use fast hash like MD5/SHA1/SHA256
- Reveal if email exists in login error
- Log passwords (even hashed)

## Common Pitfalls

**Incorrect: Fast hash**
```go
// ❌ Vulnerable to brute force
hash := sha256.Sum256([]byte(password))
```

**Correct: Memory-hard hash**
```go
// ✅ Resistant to GPU attacks
hash := argon2.IDKey(password, salt, iterations, memory, parallelism, keyLen)
```

**Incorrect: Timing attack vulnerable**
```go
// ❌ Early return leaks information
if hash[0] != computed[0] {
    return false  // Different timing!
}
```

**Correct: Constant time**
```go
// ✅ Same timing regardless of match position
return subtle.ConstantTimeCompare(hash, computed) == 1
```

## Dependencies

```bash
go get golang.org/x/crypto/argon2
```

## Related

- **Auth middleware**: See `middleware-auth.md`
- **User module**: See `module-structure.md`
