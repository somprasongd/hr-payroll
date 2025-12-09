'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { EmployeeSelector } from '@/components/common/employee-selector';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { employeeService, Employee } from '@/services/employee.service';
import { ptWorklogService, PTWorklog } from '@/services/pt-worklog.service';
import { payoutPtService } from '@/services/payout-pt.service';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';

export default function CreatePayoutPtPage() {
  const t = useTranslations('Payouts.PT.create');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Payouts.PT.errors');
  const tSuccess = useTranslations('Payouts.PT.success');
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(searchParams.get('employeeId') || '');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [worklogs, setWorklogs] = useState<PTWorklog[]>([]);
  const [selectedWorklogIds, setSelectedWorklogIds] = useState<string[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingWorklogs, setLoadingWorklogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeDetails(selectedEmployeeId);
      fetchPendingWorklogs(selectedEmployeeId);
    } else {
      setSelectedEmployee(null);
      setWorklogs([]);
      setSelectedWorklogIds([]);
    }
  }, [selectedEmployeeId]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const data = await employeeService.getEmployees({ limit: 100, status: 'active', employeeTypeCode: 'pt' });
      setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees', error);
      toast({
        variant: 'destructive',
        title: tErrors('createFailed'),
        description: 'Failed to fetch employees',
      });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchEmployeeDetails = async (id: string) => {
    try {
      const data = await employeeService.getEmployee(id);
      setSelectedEmployee(data);
    } catch (error) {
      console.error('Failed to fetch employee details', error);
    }
  };

  const fetchPendingWorklogs = async (empId: string) => {
    setLoadingWorklogs(true);
    try {
      const data = await ptWorklogService.getWorklogs({
        employeeId: empId,
        status: 'pending',
        limit: 100, // Fetch enough pending logs
      });
      const worklogs = data.data || [];
      setWorklogs(worklogs);
      // Default select all? Maybe not, let user choose.
      // Or select all by default for convenience.
      // Let's select all by default.
      setSelectedWorklogIds(worklogs.map(w => w.id));
    } catch (error) {
      console.error('Failed to fetch worklogs', error);
      toast({
        variant: 'destructive',
        title: tErrors('createFailed'),
        description: 'Failed to fetch pending worklogs',
      });
    } finally {
      setLoadingWorklogs(false);
    }
  };

  const handleToggleWorklog = (id: string) => {
    setSelectedWorklogIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorklogIds(worklogs.map(w => w.id));
    } else {
      setSelectedWorklogIds([]);
    }
  };

  const calculateTotals = () => {
    const selectedLogs = worklogs.filter(w => selectedWorklogIds.includes(w.id));
    const totalHours = selectedLogs.reduce((sum, w) => sum + w.totalHours, 0);
    const rate = selectedEmployee?.basePayAmount || 0;
    const amount = totalHours * rate;
    return { totalHours, amount, count: selectedLogs.length };
  };

  const handleSubmit = async () => {
    if (!selectedEmployeeId || selectedWorklogIds.length === 0) return;

    setSubmitting(true);
    try {
      const result = await payoutPtService.createPayout({
        employeeId: selectedEmployeeId,
        worklogIds: selectedWorklogIds,
      });
      toast({
        title: tSuccess('created'),
      });
      // Redirect to detail page for review (all roles)
      if (result?.id) {
        router.push(`/payouts/pt/${result.id}`);
      } else {
        router.push(`/payouts/pt?employeeId=${selectedEmployeeId}`);
      }
    } catch (error) {
      console.error('Failed to create payout', error);
      toast({
        variant: 'destructive',
        title: tErrors('createFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/payouts/pt${selectedEmployeeId ? `?employeeId=${selectedEmployeeId}` : ''}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('createTitle')}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Selection & List */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('step1')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeSelector
                employees={employees}
                selectedEmployeeId={selectedEmployeeId}
                onSelect={setSelectedEmployeeId}
                placeholder={t('selectEmployeePlaceholder')}
                searchPlaceholder="Search employee..."
                emptyText="No employee found"
                filterType="pt"
              />
            </CardContent>
          </Card>

          {selectedEmployeeId && (
            <Card>
              <CardHeader>
                <CardTitle>{t('step2')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingWorklogs ? (
                  <div className="text-center py-8 text-gray-500">{tCommon('loading')}</div>
                ) : worklogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">{t('noPendingWorklogs')}</div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedWorklogIds.length === worklogs.length && worklogs.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead className="text-right">Amount (Est.)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {worklogs.map((w) => {
                          const rate = selectedEmployee?.basePayAmount || 0;
                          const amount = w.totalHours * rate;
                          return (
                            <TableRow key={w.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedWorklogIds.includes(w.id)}
                                  onCheckedChange={() => handleToggleWorklog(w.id)}
                                />
                              </TableCell>
                              <TableCell>{format(new Date(w.workDate), 'dd/MM/yyyy')}</TableCell>
                              <TableCell>{w.totalHours.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Summary */}
        <div className="md:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>{t('step3')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('selectedWorklogs', { count: totals.count })}</span>
                  <span className="font-medium">{totals.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('totalHours', { hours: totals.totalHours.toFixed(2) })}</span>
                  <span className="font-medium">{totals.totalHours.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('hourlyRate', { rate: (selectedEmployee?.basePayAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) })}</span>
                  <span className="font-medium">{(selectedEmployee?.basePayAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="font-bold">{t('estimatedAmount', { amount: '' })}</span>
                  <span className="text-xl font-bold text-green-600">
                    {totals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={totals.count === 0 || submitting}
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {tCommon('save')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
