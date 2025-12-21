'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Loader2, DollarSign, Trash2, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { payoutPtService, PayoutPt } from '@/services/payout-pt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { orgProfileService, OrgProfile } from '@/services/org-profile.service';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { PtPayoutPrintTemplate } from '@/components/payroll/pt-payout-print-template';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PayoutPtDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations('Payouts.PT');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Payouts.PT.errors');
  const tSuccess = useTranslations('Payouts.PT.success');
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [payout, setPayout] = useState<PayoutPt | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Print functionality
  const printRef = useRef<HTMLDivElement>(null);
  const [orgProfile, setOrgProfile] = useState<OrgProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printOriginal, setPrintOriginal] = useState(true);
  const [printCopy, setPrintCopy] = useState(true);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `PTAdvance_${employee?.employeeNumber || ''}_${employee?.firstName || ''}${employee?.lastName || ''}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 5mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
  });

  useEffect(() => {
    fetchPayout();
    fetchOrgProfile();
  }, [id]);

  const fetchOrgProfile = async () => {
    try {
      const data = await orgProfileService.getEffective();
      setOrgProfile(data);
      if (data.logoId) {
        const url = await orgProfileService.fetchLogoWithCache(data.logoId);
        setLogoUrl(url);
      }
    } catch (error) {
      console.error('Failed to fetch org profile', error);
    }
  };

  const fetchPayout = async () => {
    setLoading(true);
    try {
      const data = await payoutPtService.getPayout(id);
      setPayout(data);
      if (data.employeeId) {
        fetchEmployee(data.employeeId);
      }
    } catch (error) {
      console.error('Failed to fetch payout', error);
      toast({
        variant: 'destructive',
        title: tErrors('fetchFailed'), // Assuming generic fetch failed exists or use custom
        description: 'Failed to fetch payout details',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployee = async (id: string) => {
    try {
      const data = await employeeService.getEmployee(id);
      setEmployee(data);
    } catch (error) {
      console.error('Failed to fetch employee', error);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payout) return;
    setMarkingPaid(true);
    try {
      await payoutPtService.markAsPaid(payout.id);
      toast({
        title: tSuccess('paid'),
      });
      fetchPayout(); // Refresh data
    } catch (error) {
      console.error('Failed to mark as paid', error);
      toast({
        variant: 'destructive',
        title: tErrors('payFailed'),
      });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDelete = async () => {
    if (!payout) return;
    setDeleting(true);
    try {
      await payoutPtService.delete(payout.id);
      toast({
        title: t('deleteSuccess'),
      });
      router.push(`/payouts/pt${payout.employeeId ? `?employeeId=${payout.employeeId}` : ''}`);
    } catch (error) {
      console.error('Failed to delete payout', error);
      toast({
        variant: 'destructive',
        title: t('deleteError'),
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'to_pay':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('statuses.to_pay')}</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('statuses.paid')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">{tCommon('loading')}</div>;
  }

  if (!payout) {
    return <div className="text-center py-8">{t('noData')}</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/payouts/pt${payout?.employeeId ? `?employeeId=${payout.employeeId}` : ''}`)}>

            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('detailTitle')}</h1>
            <div className="text-sm text-gray-500">ID: {payout.id}</div>
          </div>
        </div>
        
        {payout.status === 'to_pay' && (
          <div className="flex items-center gap-2">
            {/* Approve button - admin only */}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    {t('actions.markAsPaid')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmPay.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('confirmPay.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleMarkAsPaid} disabled={markingPaid}>
                      {markingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : t('actions.markAsPaid')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            {/* Delete button - all roles */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {tCommon('delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tCommon('confirmDeleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tCommon('confirmDeleteDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : tCommon('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Print Button - Only when paid */}
        {payout.status === 'paid' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">พิมพ์:</span>
            <div className="flex items-center gap-1">
              <Checkbox
                id="printOriginal"
                checked={printOriginal}
                onCheckedChange={(checked) => {
                  if (!checked && !printCopy) return;
                  setPrintOriginal(checked === true);
                }}
                className="h-4 w-4"
              />
              <label htmlFor="printOriginal" className="text-sm cursor-pointer">ต้นฉบับ</label>
            </div>
            <div className="flex items-center gap-1">
              <Checkbox
                id="printCopy"
                checked={printCopy}
                onCheckedChange={(checked) => {
                  if (!checked && !printOriginal) return;
                  setPrintCopy(checked === true);
                }}
                className="h-4 w-4"
              />
              <label htmlFor="printCopy" className="text-sm cursor-pointer">สำเนา</label>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPrinting(true);
                setTimeout(() => {
                  handlePrint();
                  setPrinting(false);
                }, 100);
              }}
              disabled={printing || (!printOriginal && !printCopy)}
            >
              <Printer className="w-4 h-4 mr-2" />
              พิมพ์สลิป
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('fields.itemCount')} ({payout.itemCount})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('fields.workDate')}</TableHead>
                      <TableHead>{t('fields.totalHours')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payout.items?.map((item) => (
                      <TableRow key={item.worklogId}>
                        <TableCell>{format(new Date(item.workDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{item.totalHours.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">{t('fields.employee')}</label>
                <div className="font-medium text-lg">
                  {employee ? `${employee.titleName || ''} ${employee.firstName || employee.FirstName || ''} ${employee.lastName || employee.LastName || ''}`.trim() : payout.employeeId}
                </div>
                <div className="text-sm text-gray-500">{employee?.employeeNumber || employee?.EmployeeNumber}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">{t('fields.status')}</label>
                <div className="mt-1">{getStatusBadge(payout.status)}</div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('fields.totalHours')}</span>
                  <span className="font-medium">{(payout.totalHours || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{t('fields.amountTotal')}</span>
                  <span className="text-2xl font-bold text-green-600">
                    {(payout.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t text-sm text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>{t('fields.createdAt')}</span>
                  <span>
                    {payout.createdAt && !isNaN(new Date(payout.createdAt).getTime()) 
                      ? format(new Date(payout.createdAt), 'dd/MM/yyyy HH:mm') 
                      : '-'}
                  </span>
                </div>
                {payout.paidAt && (
                  <div className="flex justify-between">
                    <span>{t('fields.paidAt')}</span>
                    <span>
                      {!isNaN(new Date(payout.paidAt).getTime())
                        ? format(new Date(payout.paidAt), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden Print Template */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PtPayoutPrintTemplate
            payout={payout}
            employee={employee}
            orgProfile={orgProfile}
            logoUrl={logoUrl || undefined}
            printOriginal={printOriginal}
            printCopy={printCopy}
          />
        </div>
      </div>
    </div>
  );
}
