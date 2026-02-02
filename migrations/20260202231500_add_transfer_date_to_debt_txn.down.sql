-- Drop constraint
ALTER TABLE debt_txn DROP CONSTRAINT IF EXISTS debt_txn_payment_details_ck;

-- Revert constraint (without transfer_date)
ALTER TABLE debt_txn
ADD CONSTRAINT debt_txn_payment_details_ck
CHECK (
  (payment_method IS NULL) OR
  (payment_method = 'cash' AND company_bank_account_id IS NULL AND transfer_time IS NULL) OR
  (payment_method = 'bank_transfer' AND company_bank_account_id IS NOT NULL AND transfer_time IS NOT NULL AND length(transfer_time) > 0)
);

-- Drop column
ALTER TABLE debt_txn DROP COLUMN transfer_date;
