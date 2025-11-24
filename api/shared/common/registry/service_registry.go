package registry

import "sync"

type ProvidedService struct {
	Key   string
	Value interface{}
}

type ServiceRegistry interface {
	Register(key string, value interface{})
	Get(key string) (interface{}, bool)
}

type memoryRegistry struct {
	mu   sync.RWMutex
	data map[string]interface{}
}

func NewServiceRegistry() ServiceRegistry {
	return &memoryRegistry{data: make(map[string]interface{})}
}

func (r *memoryRegistry) Register(key string, value interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data[key] = value
}

func (r *memoryRegistry) Get(key string) (interface{}, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	v, ok := r.data[key]
	return v, ok
}
