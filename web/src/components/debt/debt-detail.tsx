'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Wallet } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { debtService, DebtTxn } from '@/services/debt.service';
import { useAuthStore } from '@/store/auth-store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DebtDetailProps {
  id: string;
}

export function DebtDetail({ id }: DebtDetailProps) {
  const t = useTranslations('Debt');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  
  const [data, setData] = useState<DebtTxn | null>(null);
  const [loading, setLoading] = useState(true);
  const [approveOpen, setApproveOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await debtService.getDebtTxn(id);
      setData(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await debtService.approveDebtTxn(id);
      setApproveOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">{tCommon('loading')}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center">{tCommon('noData')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/debt?employeeId=${data.employeeId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('detailTitle')}</h1>
            {data.employeeName && (
              <p className="text-sm text-gray-500 mt-1">{data.employeeName}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {data.status === 'pending' && user?.role === 'admin' && (
            <Button onClick={() => setApproveOpen(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('actions.approve')}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
              <div className="text-gray-500">{t('fields.employee')}</div>
              <div className="font-medium">{data.employeeName || data.employeeId}</div>
              
              <div className="text-gray-500">{t('fields.txnDate')}</div>
              <div className="font-medium">{format(new Date(data.txnDate), 'dd/MM/yyyy')}</div>
              
              <div className="text-gray-500">{t('fields.txnType')}</div>
              <div className="font-medium capitalize">
                {t(`types.${data.txnType}`)}
                {data.installments && data.installments.length > 0 && ` (${t('types.installment')})`}
              </div>
              
              <div className="text-gray-500">{t('fields.amount')}</div>
              <div className="font-medium text-lg">{data.amount.toLocaleString()}</div>
              
              <div className="text-gray-500">{t('fields.status')}</div>
              <div>
                <Badge variant={data.status === 'approved' ? 'default' : 'secondary'}>
                  {t(`status.${data.status}`)}
                </Badge>
              </div>

              {data.otherDesc && (
                <>
                  <div className="text-gray-500">{t('fields.otherDesc')}</div>
                  <div className="font-medium">{data.otherDesc}</div>
                </>
              )}

              {data.reason && (
                <>
                  <div className="text-gray-500">{t('fields.reason')}</div>
                  <div className="font-medium col-span-2 mt-1 p-2 bg-gray-50 rounded">{data.reason}</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {data.installments && data.installments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('fields.installments')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.payrollMonth')}</TableHead>
                    <TableHead>{t('fields.amount')}</TableHead>
                    <TableHead>{t('fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.installments.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell>{inst.payrollMonthDate ? format(new Date(inst.payrollMonthDate), 'MM/yyyy') : '-'}</TableCell>
                      <TableCell>{inst.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={inst.status === 'approved' ? 'default' : 'secondary'}>
                          {t(`installmentStatus.${inst.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.approve')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('approve.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              {tCommon('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
