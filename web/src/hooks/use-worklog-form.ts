import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface UseWorklogFormProps {
  mode: 'create' | 'edit';
  lastSelectedEmployeeId?: string;
}

export function useWorklogForm({ mode, lastSelectedEmployeeId }: UseWorklogFormProps) {
  const t = useTranslations('Common');
  // We can't easily share specific translation namespaces if they differ, 
  // but we can pass error messages or handle generic ones.
  
  const [employeeId, setEmployeeId] = useState(lastSelectedEmployeeId || '');
  const [workDate, setWorkDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateBase = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (mode === 'create') {
        if (!employeeId) {
            newErrors.employeeId = 'Required'; // The component should translate this or we pass t
            isValid = false;
        }
        if (!workDate) {
            newErrors.workDate = 'Required';
            isValid = false;
        }
    }

    return { isValid, newErrors };
  }, [mode, employeeId, workDate]);

  const handleSubmitWrapper = async (
    submitFn: () => Promise<void>,
    tErrors: (key: string) => string
  ) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitFn();
      return true;
    } catch (error: any) {
      console.error('Form submit error:', error);
      const status = error?.response?.status || error?.status;
      const detail = error?.response?.data?.detail || '';
      const errorMessage = error?.message || '';
      
      if (status === 409 || errorMessage.includes('409') || detail.toLowerCase().includes('already exists')) {
        setSubmitError(tErrors('errors.duplicateWorklog'));
      } else {
        setSubmitError(detail || tErrors('errors.saveFailed'));
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormState = (newEmployeeId?: string) => {
    // If we want to keep employeeId for next entry in create mode
    if (newEmployeeId !== undefined) {
        setEmployeeId(newEmployeeId);
    }
    setErrors({});
    setSubmitError(null);
  };

  return {
    employeeId,
    setEmployeeId,
    workDate,
    setWorkDate,
    isSubmitting,
    setIsSubmitting,
    errors,
    setErrors,
    submitError,
    setSubmitError,
    handleSubmitWrapper,
    resetFormState,
  };
}
