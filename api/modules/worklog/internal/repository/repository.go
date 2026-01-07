package repository

import "hrms/shared/common/storage/sqldb/transactor"

type Repository struct {
	dbCtx  transactor.DBTXContext
	FTRepo FTRepository
	PTRepo PTRepository
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{
		dbCtx:  dbCtx,
		FTRepo: NewFTRepository(dbCtx),
		PTRepo: NewPTRepository(dbCtx),
	}
}
