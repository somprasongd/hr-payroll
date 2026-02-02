-- Drop new constraint
ALTER TABLE debt_txn DROP CONSTRAINT IF EXISTS debt_txn_payment_details_ck;

-- Drop company_bank_account_id column  
ALTER TABLE debt_txn DROP COLUMN IF EXISTS company_bank_account_id;

-- Restore legacy bank columns
ALTER TABLE debt_txn 
ADD COLUMN bank_name TEXT NULL,
ADD COLUMN bank_account_number TEXT NULL,
ADD COLUMN bank_id UUID REFERENCES banks(id);

-- Restore old constraint
ALTER TABLE debt_txn
ADD CONSTRAINT debt_txn_payment_details_ck
CHECK (
  (payment_method IS NULL) OR
  (payment_method = 'cash' AND bank_name IS NULL AND bank_account_number IS NULL AND transfer_time IS NULL) OR
  (payment_method = 'bank_transfer' AND bank_name IS NOT NULL AND length(bank_name) > 0 AND bank_account_number IS NOT NULL AND length(bank_account_number) > 0 AND transfer_time IS NOT NULL AND length(transfer_time) > 0)
);
