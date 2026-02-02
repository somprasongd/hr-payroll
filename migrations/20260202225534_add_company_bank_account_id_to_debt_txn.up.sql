-- Drop old constraint that references bank_name and bank_account_number
ALTER TABLE debt_txn DROP CONSTRAINT IF EXISTS debt_txn_payment_details_ck;

-- Clear payment method data for any existing rows (since it's not valid anymore)
UPDATE debt_txn SET payment_method = NULL, transfer_time = NULL WHERE payment_method IS NOT NULL;

-- Drop legacy bank columns
ALTER TABLE debt_txn 
DROP COLUMN IF EXISTS bank_name,
DROP COLUMN IF EXISTS bank_account_number,
DROP COLUMN IF EXISTS bank_id;

-- Add company_bank_account_id column
ALTER TABLE debt_txn ADD COLUMN company_bank_account_id UUID REFERENCES company_bank_accounts(id);

-- Add new constraint for payment method
ALTER TABLE debt_txn
ADD CONSTRAINT debt_txn_payment_details_ck
CHECK (
  (payment_method IS NULL) OR
  (payment_method = 'cash' AND company_bank_account_id IS NULL AND transfer_time IS NULL) OR
  (payment_method = 'bank_transfer' AND company_bank_account_id IS NOT NULL AND transfer_time IS NOT NULL AND length(transfer_time) > 0)
);
