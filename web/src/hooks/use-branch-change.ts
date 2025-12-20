import { useEffect, useRef } from 'react';
import { useTenantStore } from '@/store/tenant-store';

/**
 * Hook that triggers a callback when the current branch changes.
 * Useful for refetching data when user switches branch.
 */
export function useBranchChange(callback: () => void) {
  const { currentBranch } = useTenantStore();  // Changed from currentBranches
  const currentBranchId = currentBranch?.id;
  const previousBranchIdRef = useRef<string | undefined>(currentBranchId);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Skip the first mount - only trigger on actual changes
    if (isFirstMount.current) {
      isFirstMount.current = false;
      previousBranchIdRef.current = currentBranchId;
      return;
    }

    // Only trigger if branch actually changed
    if (currentBranchId !== previousBranchIdRef.current) {
      previousBranchIdRef.current = currentBranchId;
      callback();
    }
  }, [currentBranchId, callback]);

  return currentBranchId;
}

/**
 * Returns the current branch ID from tenant store.
 */
export function useCurrentBranchId(): string | undefined {
  const { currentBranch } = useTenantStore();  // Changed from currentBranches
  return currentBranch?.id;
}
