package main

import (
	"fmt"

	"github.com/matthewhartstonge/argon2"
)

func main() {
	argon := argon2.DefaultConfig()

	// Waaahht??! It includes magic salt generation for me ! Yasss...
	encoded, err := argon.HashEncoded([]byte("changeme"))
	if err != nil {
		panic(err) // 💥
	}

	fmt.Println(string(encoded))
	// > $argon2id$v=19$m=65536,t=1,p=4$WXJGqwIB2qd+pRmxMOw9Dg$X4gvR0ZB2DtQoN8vOnJPR2SeFdUhH9TyVzfV98sfWeE

	ok, err := argon2.VerifyEncoded([]byte("changeme"), encoded)
	if err != nil {
		panic(err) // 💥
	}

	matches := "no 🔒"
	if ok {
		matches = "yes 🔓"
	}
	fmt.Printf("Password Matches: %s\n", matches)
}

// func main() {
// 	// Command‑line flag for password (optional)
// 	passPtr := flag.String("password", "", "Password to hash")
// 	flag.Parse()

// 	var password string
// 	if *passPtr != "" {
// 		password = *passPtr
// 	} else {
// 		// Read from stdin if no flag provided
// 		fmt.Fprint(os.Stderr, "Enter password: ")
// 		fmt.Scanln(&password)
// 	}

// 	// Default Argon2id parameters
// 	const (
// 		memory  = 64 * 1024 // 64 MiB
// 		time    = 1
// 		threads = 4
// 		saltLen = 16
// 		keyLen  = 32
// 	)

// 	// Generate a random salt
// 	salt := make([]byte, saltLen)
// 	if _, err := rand.Read(salt); err != nil {
// 		fmt.Fprintln(os.Stderr, "Error generating salt:", err)
// 		os.Exit(1)
// 	}

// 	// Compute the hash
// 	hash := argon2.IDKey([]byte(password), salt, time, memory, threads, keyLen)

// 	// Encode to base64 for storage
// 	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
// 	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

// 	// Format: $argon2id$v=19$m=65536,t=1,p=4$<salt>$<hash>
// 	fmt.Printf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s\n", memory, time, threads, b64Salt, b64Hash)
// }
