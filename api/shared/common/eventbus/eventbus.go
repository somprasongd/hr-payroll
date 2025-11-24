package eventbus

type Event interface {
	Name() string
}

type Handler func(Event)

type EventBus interface {
	Publish(event Event)
	Subscribe(name string, handler Handler)
}

type inMemoryBus struct {
	handlers map[string][]Handler
}

func NewInMemory() EventBus {
	return &inMemoryBus{handlers: make(map[string][]Handler)}
}

func (b *inMemoryBus) Publish(event Event) {
	if event == nil {
		return
	}
	if hs, ok := b.handlers[event.Name()]; ok {
		for _, h := range hs {
			go h(event)
		}
	}
}

func (b *inMemoryBus) Subscribe(name string, handler Handler) {
	if handler == nil {
		return
	}
	b.handlers[name] = append(b.handlers[name], handler)
}
