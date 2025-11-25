# Settings Page Documentation

## Overview

The settings page (`/settings`) provides an administrative interface for managing payroll configuration settings. It integrates with the Payroll Configuration API endpoints from the specification.

## Features

### 1. **Configuration Management**

- View current active configuration
- Edit payroll rates and settings
- Save new configuration versions
- View configuration history

### 2. **Organized Tabs Interface**

The settings are organized into 4 intuitive tabs:

#### **Wage Rates Tab**

- Hourly Rate: Base wage for part-time employees
- OT Hourly Rate: Overtime rate per hour
- Effective Date: When the configuration takes effect

#### **Bonuses & Benefits Tab**

- Attendance Bonus (No Late): Bonus for punctual employees
- Attendance Bonus (No Leave): Bonus for employees with perfect attendance
- Housing Allowance: Monthly housing benefit

#### **Utilities Tab**

- Water Rate per Unit: Cost per water unit
- Electricity Rate per Unit: Cost per electricity unit
- Monthly Internet Fee: Fixed monthly internet cost

#### **Social Security Tab**

- Employee Rate: Social security deduction percentage for employees
- Employer Rate: Social security contribution percentage for employers

### 3. **Configuration History**

- View all past configurations in a modal dialog
- See version numbers, dates, status, and notes
- Visual badges for active vs retired configurations

## API Integration

### Endpoints Used

1. **GET /admin/payroll-configs/effective**

   - Fetches the currently active configuration
   - Loads data into the form automatically

2. **POST /admin/payroll-configs**

   - Creates a new configuration version
   - The API handles versioning and retirement of old configs

3. **GET /admin/payroll-configs**
   - Retrieves configuration history
   - Used for the history modal

## Data Flow

```
1. Page Load
   ├── Fetch effective config → Populate form
   └── Fetch config history → Store for history modal

2. User Edits Form
   └── Updates local formData state

3. User Clicks Save
   ├── POST new config to API
   ├── Refresh effective config
   ├── Refresh history
   └── Show success message

4. User Clicks Reset
   └── Re-fetch effective config → Reset form
```

## Key Components

### Main Component

- **SettingsPage** (`/app/[locale]/settings/page.tsx`)
  - Manages all configuration state
  - Handles API calls
  - Renders tabbed interface

### UI Components Used

- `Card` - For section containers
- `Tabs` - For organized navigation
- `Input` - For numeric fields
- `Textarea` - For notes
- `Dialog` - For history modal
- `Table` - For history display
- `Alert` - For status messages
- `Badge` - For status indicators

## Multi-language Support

The page supports 3 languages:

- **Thai (th)** - Default
- **English (en)** - English translations
- **Myanmar (my)** - Burmese translations

All UI text is externalized in `/messages/{locale}.json` under the `Settings` namespace.

## Access Control

**Required Permission:** Admin role only

The API endpoints are protected and require:

- Valid authentication token (Bearer token)
- Admin role permission

## UX Features

### 1. **Loading States**

- Spinner shown while fetching data
- Disabled buttons during save operations

### 2. **Error Handling**

- API errors displayed in red alert boxes
- Network errors caught and shown to users

### 3. **Success Feedback**

- Green success message after save
- Auto-dismisses after 3 seconds

### 4. **Form Validation**

- All numeric fields use `type="number"`
- Step size configured for decimal precision
- Min/max for percentage fields (social security: 0-100%)

### 5. **Responsive Design**

- Grid layouts adapt to screen size
- Mobile-friendly tabs
- Condensed history button on mobile

### 6. **Auto-Focus & Auto-Select** ✨ NEW

- First field (Hourly Rate) automatically focused on page load
- **All input fields select all text when focused** (click or tab)
- Makes editing values faster and more intuitive

### 7. **Percentage Input** ✨ NEW

- Social security rates display and accept percentage values (0-100)
- User enters **5** for 5% instead of **0.05**
- Visual **%** symbol shown in the input field
- Automatic conversion to decimal (÷100) when saving to API
- Automatic conversion from decimal (×100) when loading from API

## Implementation Details

### Clone & Edit Pattern

As per the API specification, the frontend implements a "Clone & Edit" workflow:

1. Fetch the latest active config
2. User modifies values in the form
3. On save, POST as a new configuration
4. Database trigger handles:
   - Retiring old config if dates match
   - Setting end dates if future-dated

### Version Control

- Each configuration has a version number
- Automatic versioning handled by the API
- Frontend displays current version in info alert

## Future Enhancements

Potential improvements:

- [ ] Form validation before save
- [ ] Confirmation dialog for major changes
- [ ] Compare configurations side-by-side
- [ ] Export configuration history
- [ ] Audit log of who made changes
- [ ] Schedule future configurations
- [ ] Restore from history

## Testing Checklist

- [ ] Can view current configuration
- [ ] Can edit and save new configuration
- [ ] Success/error messages display correctly
- [ ] History modal shows all versions
- [ ] All tabs navigate correctly
- [ ] Form resets properly
- [ ] Works in all 3 languages
- [ ] Responsive on mobile devices
- [ ] Proper authentication required
- [ ] Loading states work correctly
