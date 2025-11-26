# Implementation Plan - Salary Raise Management UI

## Goal Description

Implement the web UI for Salary Raise Management based on the workflow documentation. This includes managing salary raise cycles, proposing raises for employees, and approving/rejecting cycles.

## User Review Required

> [!IMPORTANT]
>
> - Confirm the location of the new pages: `/salary-raise` and `/salary-raise/[id]`.
> - Confirm the fields required for `EditRaiseItemDialog` (Raise Amount, Raise Percent, New SSO Wage).

## Proposed Changes

### Frontend Services

#### [NEW] [salary-raise.service.ts](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/services/salary-raise.service.ts)

- `getCycles(params)`
- `getCycle(id)`
- `createCycle(data)`
- `updateCycle(id, data)` (for status change)
- `deleteCycle(id)`
- `getCycleItems(cycleId, params)`
- `updateCycleItem(itemId, data)`

### Frontend Pages & Components

#### [NEW] [Salary Raise List Page](<file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/app/[locale]/(authenticated)/salary-raise/page.tsx>)

- Lists all salary raise cycles.
- Filter by Year, Status.
- "Create Cycle" button opening a dialog.

#### [NEW] [Salary Raise Detail Page](<file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/app/[locale]/(authenticated)/salary-raise/[id]/page.tsx>)

- Shows cycle details (Period, Status, Stats).
- Lists employees in the cycle (Salary Raise Items).
- "Approve" and "Reject" buttons (Admin only).
- Click on employee to edit raise.

#### [NEW] [CreateCycleDialog](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/components/salary-raise/create-cycle-dialog.tsx)

- Form to select `periodStartDate` and `periodEndDate`.

#### [NEW] [EditRaiseItemDialog](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/components/salary-raise/edit-raise-item-dialog.tsx)

- Form to input `raisePercent` or `raiseAmount`.
- Shows calculated `newSalary`.
- Input for `newSsoWage`.

### Translations

#### [MODIFY] [en.json](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/messages/en.json)

#### [MODIFY] [th.json](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/messages/th.json)

- Add keys for Salary Raise feature.

## Verification Plan

### Manual Verification

- **Create Cycle**: Create a new cycle and verify it appears in the list.
- **List Items**: Open the cycle and verify employees are listed with correct stats.
- **Edit Item**: Edit an employee's raise and verify `newSalary` calculation and save.
- **Approve/Reject**:
  - Approve a cycle and verify status changes.
  - Reject a cycle and verify status changes.
