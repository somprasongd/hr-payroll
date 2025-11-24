package mediator

import (
	"context"
	"errors"
	"fmt"
	"reflect"
)

// NoResponse can be used for commands without return payload.
type NoResponse struct{}

// RequestHandler represents a handler that processes a request and returns a response.
type RequestHandler[TRequest any, TResponse any] interface {
	Handle(ctx context.Context, request TRequest) (TResponse, error)
}

var handlers = map[reflect.Type]func(ctx context.Context, req interface{}) (interface{}, error){}

// Register binds a handler to the request type.
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

// Send dispatches the request to the registered handler.
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
