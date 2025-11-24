package build

var (
	// Version and Time are injected at build time via -ldflags.
	Version = "dev"
	Time    = "unknown"
)
