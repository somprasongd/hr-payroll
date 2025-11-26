# Salary Raise UI Walkthrough

This document outlines the implementation of the Salary Raise Management UI and how to verify it.

## Implemented Features

1.  **Salary Raise Cycles List**

    - Page: `/salary-raise`
    - Features: List all cycles, filter by status (visual badge), Create new cycle.
    - Components: `SalaryRaiseCycleList`, `CreateCycleDialog`.

2.  **Salary Raise Cycle Detail**

    - Page: `/salary-raise/[id]`
    - Features: View cycle details, Approve/Reject cycle (Admin), View employee list with stats.
    - Components: `SalaryRaiseCycleDetail` (Header), `SalaryRaiseItemsTable`.

3.  **Edit Raise Item**
    - Dialog: Opens when clicking "Edit" on an employee in the list.
    - Features: Adjust Raise % or Amount, Preview New Salary, Adjust New SSO Wage.
    - Components: `EditRaiseItemDialog`.

## Verification Steps

### 1. Create a New Cycle

1.  Navigate to `/salary-raise`.
2.  Click **"Create Cycle"**.
3.  Select a date range (e.g., `2025-01-01` to `2025-12-31`).
4.  Click **"Save"**.
5.  **Verify:** The new cycle appears in the list with "Pending" status.

### 2. Propose Raise

1.  Click on the "View" icon (eye) for the pending cycle.
2.  You should see a list of full-time employees with their stats (Late, Leave, OT).
3.  Click the **"Edit"** (pencil) button on an employee row.
4.  Enter `10` in "Raise %".
5.  **Verify:** "Raise Amount" and "New Salary" are calculated automatically.
6.  Click **"Save"**.
7.  **Verify:** The table updates with the new values.

### 3. Approve Cycle (Admin)

1.  In the Cycle Detail page, click **"Approve Cycle"**.
2.  Confirm the dialog.
3.  **Verify:**
    - Status changes to "Approved" (Green badge).
    - "Edit" buttons in the table disappear (locked).
    - "Approve/Reject" buttons disappear.
    - (Backend Check) Employee's `basePayAmount` in `employees` table is updated.

### 4. Reject Cycle (Admin)

1.  Create another cycle.
2.  In the Detail page, click **"Reject Cycle"**.
3.  Confirm.
4.  **Verify:** Status changes to "Rejected" (Red badge).

## Files Created

- `web/src/services/salary-raise.service.ts`
- `web/src/app/[locale]/(authenticated)/salary-raise/page.tsx`
- `web/src/app/[locale]/(authenticated)/salary-raise/[id]/page.tsx`
- `web/src/components/salary-raise/salary-raise-cycle-list.tsx`
- `web/src/components/salary-raise/create-cycle-dialog.tsx`
- `web/src/components/salary-raise/salary-raise-cycle-detail.tsx`
- `web/src/components/salary-raise/salary-raise-items-table.tsx`
- `web/src/components/salary-raise/edit-raise-item-dialog.tsx`
