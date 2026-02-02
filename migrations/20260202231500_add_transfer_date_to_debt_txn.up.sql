-- Add transfer_date to debt_txn
ALTER TABLE debt_txn ADD COLUMN transfer_date DATE NULL;

-- Backfill transfer_date for existing bank transfers (use txn_date as default)
UPDATE debt_txn 
SET transfer_date = txn_date 
WHERE payment_method = 'bank_transfer' AND transfer_date IS NULL;

-- Update constraint to include transfer_date check for bank_transfer
ALTER TABLE debt_txn DROP CONSTRAINT IF EXISTS debt_txn_payment_details_ck;

ALTER TABLE debt_txn
ADD CONSTRAINT debt_txn_payment_details_ck
CHECK (
  (payment_method IS NULL) OR
  (payment_method = 'cash' AND company_bank_account_id IS NULL AND transfer_time IS NULL AND transfer_date IS NULL) OR
  (payment_method = 'bank_transfer' AND company_bank_account_id IS NOT NULL AND transfer_time IS NOT NULL AND length(transfer_time) > 0 AND transfer_date IS NOT NULL)
);
