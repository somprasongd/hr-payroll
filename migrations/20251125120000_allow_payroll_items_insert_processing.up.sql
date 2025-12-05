-- Allow generating payroll_run_item rows while the parent run is still processing.
CREATE OR REPLACE FUNCTION payroll_run_item_guard_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM payroll_run WHERE id = COALESCE(NEW.run_id, OLD.run_id);

  -- During generation (INSERT), permit pending or processing runs.
  IF TG_OP = 'INSERT' THEN
    IF v_status NOT IN ('pending', 'processing') THEN
      RAISE EXCEPTION 'Items can be created only when payroll_run is pending or processing (current: %)', v_status;
    END IF;
    RETURN NEW;
  END IF;

  -- Updates remain restricted to pending runs.
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Items can be edited only when payroll_run is pending (current: %)', v_status;
  END IF;
  RETURN NEW;
END$$;

-- Ensure trigger points to the updated function.
DROP TRIGGER IF EXISTS tg_payroll_run_item_guard_biu ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_guard_biu
BEFORE INSERT OR UPDATE ON payroll_run_item
FOR EACH ROW EXECUTE FUNCTION payroll_run_item_guard_edit();
