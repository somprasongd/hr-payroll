package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"hrms/application"
	"hrms/config"
	"hrms/modules/auth"
	"hrms/modules/bonus"
	"hrms/modules/employee"
	"hrms/modules/masterdata"
	"hrms/modules/payoutpt"
	"hrms/modules/payrollconfig"
	"hrms/modules/payrollrun"
	"hrms/modules/salaryadvance"
	"hrms/modules/salaryraise"
	"hrms/modules/user"
	"hrms/modules/worklog"
	"hrms/shared/common/jwt"
	"hrms/shared/common/logger"
	"hrms/shared/common/module"
	"hrms/shared/common/storage/sqldb"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @title HR Payroll API
// @version 1.0
// @description HR Payroll REST API
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Add "Bearer <access token>"
func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	closeLog, err := logger.Init(cfg.AppName)
	if err != nil {
		panic(err)
	}
	defer closeLog()

	dbCtx, closeDB, err := sqldb.NewDBContext(cfg.DSN)
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := closeDB(); err != nil {
			logger.Log().Error(fmt.Sprintf("error closing db: %v", err))
		}
	}()

	app := application.New(*cfg)

	trans, dbtxCtx := transactor.New(dbCtx.DB(),
		transactor.WithNestedTransactionStrategy(transactor.NestedTransactionsSavepoints))
	mCtx := module.NewModuleContext(trans, dbtxCtx)

	tokenSvc := jwt.NewTokenService(cfg.JWTAccessSecret, cfg.JWTRefreshSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)

	app.RegisterModules(
		auth.NewModule(mCtx, tokenSvc),
		user.NewModule(mCtx, tokenSvc),
		employee.NewModule(mCtx, tokenSvc),
		payrollconfig.NewModule(mCtx, tokenSvc),
		salaryadvance.NewModule(mCtx, tokenSvc),
		salaryraise.NewModule(mCtx, tokenSvc),
		bonus.NewModule(mCtx, tokenSvc),
		payoutpt.NewModule(mCtx, tokenSvc),
		masterdata.NewModule(mCtx, tokenSvc),
		payrollrun.NewModule(mCtx, tokenSvc),
		worklog.NewModule(mCtx, tokenSvc),
	)

	app.Run()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	_ = app.Shutdown()
}
