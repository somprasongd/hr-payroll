ALTER TABLE debt_txn
ADD COLUMN payment_method TEXT NULL CHECK (payment_method IN ('cash', 'bank_transfer')),
ADD COLUMN bank_name TEXT NULL,
ADD COLUMN bank_account_number TEXT NULL,
ADD COLUMN transfer_time TEXT NULL;

-- Constraint: Payment method details are required for bank_transfer, forbidden for cash.
-- Also ensures payment_method is only set for repayment (optional enforce, but good for data integrity)
-- But wait, maybe 'loan' (giving money to employee) could also be via bank transfer?
-- The user request is specifically for "Repayment" (การชำระคืน). So I will enforce it loosely or strictly.
-- Let's just enforce the relationship between payment_method and its details.

ALTER TABLE debt_txn
ADD CONSTRAINT debt_txn_payment_details_ck
CHECK (
  (payment_method IS NULL) OR
  (payment_method = 'cash' AND bank_name IS NULL AND bank_account_number IS NULL AND transfer_time IS NULL) OR
  (payment_method = 'bank_transfer' AND bank_name IS NOT NULL AND length(bank_name) > 0 AND bank_account_number IS NOT NULL AND length(bank_account_number) > 0 AND transfer_time IS NOT NULL AND length(transfer_time) > 0)
);
