# Design: Extract Reusable Components from HR-Payroll Web Pages

## Overview

This document outlines the architectural approach for extracting reusable components from the HR-Payroll web application. The design focuses on creating flexible, maintainable components that can be used across different sections of the application while preserving the existing functionality.

## Architecture Principles

1. **Composability**: Components should be designed to work together, allowing complex UIs to be built from simpler, reusable parts.
2. **Configurability**: Components should accept props to customize their behavior and appearance without requiring code changes.
3. **Type Safety**: All components should use TypeScript interfaces to ensure type safety and improve developer experience.
4. **Backwards Compatibility**: The extracted components should maintain the same functionality as the original implementations.

## Component Architecture

### Generic Data Table Component

**Purpose**: Replace the current table implementations in employee, bonus, debt, and other list pages.

**Interface**:
```typescript
interface GenericDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyStateText?: string;
  onRowClick?: (item: T) => void;
  actions?: ActionConfig<T>[];
  pagination?: PaginationConfig;
  sort?: SortConfig;
  className?: string;
}
```

**Features**:
- Support for dynamic columns configuration
- Loading and empty state handling
- Row selection capabilities
- Sortable columns
- Action dropdown with configurable items
- Integrated pagination

### Filter Bar Component

**Purpose**: Provide a consistent filtering experience across all list pages.

**Interface**:
```typescript
interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onFilterChange: (filterId: string, value: any) => void;
  onClearAll?: () => void;
  className?: string;
  children?: React.ReactNode;
}
```

**Features**:
- Multiple filter types (text, select, date, checkbox, etc.)
- Responsive layout (collapsible on mobile)
- Clear all filters functionality
- Support for custom filter components

### Generic Confirmation Dialog

**Purpose**: Standardize confirmation dialogs across the application.

**Interface**:
```typescript
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}
```

**Features**:
- Configurable title and description
- Different confirmation button variants
- Loading state during async operations
- Support for validation before confirmation

### Action Dropdown Component

**Purpose**: Provide consistent action menus across list items.

**Interface**:
```typescript
interface ActionDropdownProps<T> {
  item: T;
  actions: ActionConfig<T>[];
  trigger?: React.ReactNode;
  disabled?: boolean;
}
```

**Features**:
- Configurable action items with icons and callbacks
- Conditional rendering based on item properties
- Support for destructive actions
- Integration with routing and API calls

## Technical Implementation

### Component Location

New reusable components will be added to:
- `src/components/common/` - For complex, multi-purpose components
- `src/components/ui/` - For simple UI primitives that extend existing shadcn components

### Data Handling

- Use React's built-in state management for component-specific data
- Leverage existing service layer (`src/services/`) for API calls
- Implement proper error handling and loading states
- Provide callbacks for parent components to respond to actions

### Styling Approach

- Utilize existing Tailwind CSS classes for consistency
- Extend existing shadcn/ui components where possible
- Maintain responsive design patterns used throughout the application
- Follow the existing design system and color palette

## Integration Strategy

### Phase-based Approach

1. **Component Development**: Build new reusable components in isolation
2. **Testing**: Create unit tests for each new component
3. **Page Refactoring**: Replace existing implementations with new components
4. **Validation**: Ensure all functionality remains identical

### Backwards Compatibility

- Maintain all existing functionality during refactoring
- Use feature flags if needed during transition periods
- Preserve existing CSS classes where they're used in tests
- Ensure all existing prop types continue to work

## Error Handling

- Implement proper error boundaries for new components
- Provide clear error messages for API failures
- Include fallback UI for loading states
- Ensure graceful degradation if optional props are omitted

## Performance Considerations

- Optimize rendering with React.memo for list components
- Implement proper prop comparison functions
- Use virtualization for large data lists if needed
- Optimize re-renders with useCallback for callbacks

## Testing Strategy

- Unit tests for all new components using React Testing Library
- Integration tests for component interactions
- Snapshot tests for UI consistency
- Manual testing of all refactored pages to ensure functionality is preserved