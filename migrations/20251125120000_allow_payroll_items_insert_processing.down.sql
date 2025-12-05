-- Revert guard to require pending for both insert and update.
CREATE OR REPLACE FUNCTION payroll_run_item_guard_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM payroll_run WHERE id = COALESCE(NEW.run_id, OLD.run_id);
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Items can be edited only when payroll_run is pending (current: %)', v_status;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_run_item_guard_biu ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_guard_biu
BEFORE INSERT OR UPDATE ON payroll_run_item
FOR EACH ROW EXECUTE FUNCTION payroll_run_item_guard_edit();
