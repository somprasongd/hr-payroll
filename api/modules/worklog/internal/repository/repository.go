package repository

import "hrms/shared/common/storage/sqldb/transactor"

type Repository struct {
	FTRepo FTRepository
	PTRepo PTRepository
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{
		FTRepo: NewFTRepository(dbCtx),
		PTRepo: NewPTRepository(dbCtx),
	}
}
