ALTER TABLE debt_txn
DROP CONSTRAINT IF EXISTS debt_txn_payment_details_ck,
DROP COLUMN IF EXISTS transfer_time,
DROP COLUMN IF EXISTS bank_account_number,
DROP COLUMN IF EXISTS bank_name,
DROP COLUMN IF EXISTS payment_method;
