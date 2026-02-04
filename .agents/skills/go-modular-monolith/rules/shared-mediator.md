# shared-mediator

Command/query dispatcher pattern.

## Why Mediator

- Decouples handlers from endpoints
- Centralized request dispatching
- Type-safe command/query routing

## File: api/shared/common/mediator/mediator.go

```go
package mediator

import (
    "context"
    "errors"
    "fmt"
    "reflect"
)

// NoResponse for commands without return value
type NoResponse struct{}

// RequestHandler processes a request and returns a response
type RequestHandler[TRequest any, TResponse any] interface {
    Handle(ctx context.Context, request TRequest) (TResponse, error)
}

var handlers = map[reflect.Type]func(ctx context.Context, req interface{}) (interface{}, error){}

// Register binds a handler to a request type
func Register[TRequest any, TResponse any](handler RequestHandler[TRequest, TResponse]) {
    var req TRequest
    reqType := reflect.TypeOf(req)

    handlers[reqType] = func(ctx context.Context, request interface{}) (interface{}, error) {
        typedReq, ok := request.(TRequest)
        if !ok {
            return nil, errors.New("invalid request type")
        }
        return handler.Handle(ctx, typedReq)
    }
}

// Send dispatches a request to its registered handler
func Send[TRequest any, TResponse any](ctx context.Context, req TRequest) (TResponse, error) {
    reqType := reflect.TypeOf(req)
    handler, ok := handlers[reqType]
    if !ok {
        var empty TResponse
        return empty, fmt.Errorf("no handler for request %T", req)
    }

    result, err := handler(ctx, req)
    if err != nil {
        var empty TResponse
        return empty, err
    }

    typedRes, ok := result.(TResponse)
    if !ok {
        var empty TResponse
        return empty, errors.New("invalid response type")
    }

    return typedRes, nil
}
```

## Usage

### Register Handler
```go
func (m *Module) Init(eventBus eventbus.EventBus) error {
    mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
    mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.tx, eventBus))
    return nil
}
```

### Send Request
```go
resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{...})
```

## Common Pitfalls

**Incorrect: Wrong type parameters**
```go
// ❌ Response type mismatch
mediator.Register[*Query, *WrongResponse](handler)
```

**Correct: Match handler return type**
```go
// ✅ Type matches handler's return
mediator.Register[*Query, *Response](handler)
```
