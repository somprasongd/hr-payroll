# Manage Bonus Workflow

This workflow describes how to manage bonus cycles using the HR Payroll System.

## 1. List Bonus Cycles

View the history of bonus cycles to see their status.

- **Action**: Navigate to `/bonuses` (or call `GET /bonus-cycles`)
- **Information**:
  - `payrollMonthDate`: The payroll month the bonus is paid in.
  - `periodStartDate` - `periodEndDate`: The performance evaluation period.
  - `status`: `pending`, `approved`, `rejected`.
  - `totalAmount`: Total bonus amount.

## 2. Create Bonus Cycle

Start a new bonus cycle. The system will automatically calculate statistics (Late, Leave, Tenure) for all Full-time employees.

- **Action**: Click "Create Cycle" on `/bonuses` (or call `POST /bonus-cycles`)
- **Inputs**:
  - `payrollMonthDate`: e.g., "2025-12-01"
  - `periodStartDate`: e.g., "2025-01-01"
  - `periodEndDate`: e.g., "2025-12-31"
- **System Behavior**:
  - Creates a new cycle with status `pending`.
  - Snapshots `worklog_ft` data for the period.
  - Calculates `tenureDays`.

## 3. Review and Adjust Bonus Items

Review the calculated statistics and input the bonus amount for each employee.

- **Action**: Click on a Pending Cycle (or call `GET /bonus-cycles/{id}/items`)
- **Review**:
  - Check `lateMinutes`, `leaveDays`, `tenureDays`.
- **Adjust**:
  - **Action**: Edit the item (or call `PATCH /bonus-items/{id}`)
  - **Inputs**:
    - `bonusMonths`: (Optional) Number of months for reference.
    - `bonusAmount`: The actual bonus amount to pay.

## 4. Approve Cycle

Finalize the bonus cycle. Once approved, it cannot be modified.

- **Action**: Click "Approve" on the Cycle Detail page (or call `PATCH /bonus-cycles/{id}` with `status: "approved"`)
- **Result**:
  - Status becomes `approved`.
  - Bonus amounts are locked and ready for Payroll processing.

## 5. Delete Cycle (If needed)

If a cycle is incorrect and still `pending` or `rejected`, it can be deleted.

- **Action**: Click "Delete" (or call `DELETE /bonus-cycles/{id}`)
