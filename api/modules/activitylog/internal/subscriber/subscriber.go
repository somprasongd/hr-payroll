package subscriber

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"hrms/modules/activitylog/internal/entity"
	"hrms/modules/activitylog/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/events"

	"github.com/google/uuid"
)

type LogSubscriber struct {
	repo *repository.Repository
}

func NewLogSubscriber(repo *repository.Repository) *LogSubscriber {
	return &LogSubscriber{repo: repo}
}

func (s *LogSubscriber) HandleLogActivity(ev eventbus.Event) {
	e, ok := ev.(events.LogEvent)
	if !ok {
		return
	}
	// Convert details map to json byte array, or nil if empty
	var details []byte
	if e.Details != nil && len(e.Details) > 0 {
		details, _ = json.Marshal(e.Details)
	}
	s.createLog(e.ActorID, e.CompanyID, e.BranchID, e.Action, e.EntityName, e.EntityID, details, e.Timestamp)
}

func (s *LogSubscriber) createLog(userID uuid.UUID, companyID, branchID *uuid.UUID, action, entityName, entityID string, details []byte, timestamp time.Time) {
	ctx := context.Background()
	log := &entity.ActivityLog{
		UserID:    userID,
		CompanyID: companyID,
		BranchID:  branchID,
		Action:    action,
		Entity:    entityName,
		EntityID:  entityID,
		Details:   details,
		CreatedAt: timestamp,
	}

	if err := s.repo.CreateLog(ctx, log); err != nil {
		logger.Log().Error(fmt.Sprintf("failed to create activity log: %v", err))
	}
}
