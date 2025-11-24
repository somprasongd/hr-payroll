/* -------------------------------------------------------------
  Rollback – Debt‑transaction system
  ------------------------------------------------------------- */

-- 1  Drop all trigger functions that were created in the script
DROP FUNCTION IF EXISTS debt_txn_parent_guard()                 CASCADE;
DROP FUNCTION IF EXISTS debt_txn_installment_force_pending()    CASCADE;
DROP FUNCTION IF EXISTS debt_txn_status_guard()                 CASCADE;
DROP FUNCTION IF EXISTS debt_txn_cascade_soft_delete_children() CASCADE;
DROP FUNCTION IF EXISTS public.sync_loan_balance_to_accumulation()     CASCADE;

-- 2  Drop the triggers that reference those functions
DROP TRIGGER IF EXISTS tg_debt_txn_set_updated               ON debt_txn;
DROP TRIGGER IF EXISTS tg_debt_txn_parent_guard_biu          ON debt_txn;
DROP TRIGGER IF EXISTS tg_debt_txn_installment_force_pending ON debt_txn;
DROP TRIGGER IF EXISTS tg_debt_txn_status_guard_bu           ON debt_txn;
DROP TRIGGER IF EXISTS tg_debt_txn_cascade_soft_delete_children ON debt_txn;
DROP TRIGGER IF EXISTS tg_sync_loan_balance                  ON public.debt_txn;

-- 3  Drop the main table (this also drops its indexes, FK and constraints)
DROP TABLE IF EXISTS debt_txn CASCADE;

-- 4  Drop the two domains that were defined
DROP DOMAIN IF EXISTS debt_txn_type;
DROP DOMAIN IF EXISTS debt_status;
