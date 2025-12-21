'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { salaryRaiseService, SalaryRaiseItem } from '@/services/salary-raise.service';
import { payrollConfigService, PayrollConfig } from '@/services/payroll-config.service';
import { formatTenure } from '@/lib/format-tenure';

const editItemSchema = z.object({
  raisePercent: z.coerce.number().min(0),
  raiseAmount: z.coerce.number(),
  newSsoWage: z.coerce.number().min(0).optional(),
});

type EditItemFormValues = z.infer<typeof editItemSchema>;

interface EditRaiseItemDialogProps {
  item: SalaryRaiseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditRaiseItemDialog({ item, open, onOpenChange, onSuccess }: EditRaiseItemDialogProps) {
  const t = useTranslations('SalaryRaise');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);

  const form = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema) as any,
    defaultValues: {
      raisePercent: 0,
      raiseAmount: 0,
      newSsoWage: 0,
    },
  });

  // Fetch payroll config when dialog opens
  useEffect(() => {
    if (open) {
      const fetchConfig = async () => {
        try {
          const config = await payrollConfigService.getEffective();
          setPayrollConfig(config);
        } catch (error) {
          console.error('Failed to fetch payroll config:', error);
        }
      };
      fetchConfig();
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      form.reset({
        raisePercent: item.raisePercent || 0,
        raiseAmount: item.raiseAmount || 0,
        newSsoWage: item.newSsoWage || item.currentSsoWage || 0,
      });
    }
  }, [item, form]);

  const currentSalary = item?.currentSalary || 0;
  const raisePercent = form.watch('raisePercent');
  const raiseAmount = form.watch('raiseAmount');

  // Get wage cap from config or default to 15000
  const wageCap = payrollConfig?.socialSecurityWageCap || 17500;

  // Calculate new salary for preview
  const newSalary = currentSalary + (form.watch('raiseAmount') || 0);

  // Auto-update newSsoWage when raise amount changes (cap at wageCap)
  const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value) || 0;
    const amount = (currentSalary * percent) / 100;
    const calculatedNewSalary = currentSalary + amount;
    const calculatedSsoWage = Math.min(calculatedNewSalary, wageCap);
    
    form.setValue('raisePercent', percent);
    form.setValue('raiseAmount', parseFloat(amount.toFixed(2)));
    form.setValue('newSsoWage', parseFloat(calculatedSsoWage.toFixed(2)));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    const percent = currentSalary > 0 ? (amount / currentSalary) * 100 : 0;
    const calculatedNewSalary = currentSalary + amount;
    const calculatedSsoWage = Math.min(calculatedNewSalary, wageCap);
    
    form.setValue('raiseAmount', amount);
    form.setValue('raisePercent', parseFloat(percent.toFixed(2)));
    form.setValue('newSsoWage', parseFloat(calculatedSsoWage.toFixed(2)));
  };

  async function onSubmit(data: EditItemFormValues) {
    if (!item) return;

    try {
      setIsSubmitting(true);
      await salaryRaiseService.updateCycleItem(item.id, data);
      
      toast({
        title: t('editItem.saveSuccess'),
        variant: 'default',
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update item:', error);
      toast({
        title: tCommon('error'),
        description: 'Failed to update raise. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editItem.title', { name: item?.employeeName || '' })}</DialogTitle>
          <DialogDescription>
            {t('editItem.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-md mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{t('fields.currentSalary')}</span>
            <span className="text-sm">{currentSalary.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>{t('fields.newSalary')}</span>
            <span className="text-primary">{newSalary.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('fields.tenure')}:</span>
            <span className="ml-2 font-medium">{formatTenure(item?.tenureDays || 0, t)}</span>
          </div>
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground">{t('fields.stats')}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>{t('stats.late', { minutes: item?.stats?.lateMinutes || 0 })}</div>
              <div>{t('stats.leave', { days: item?.stats?.leaveDays || 0 })}</div>
              <div>{t('stats.leaveDouble', { days: item?.stats?.leaveDoubleDays || 0 })}</div>
              <div>{t('stats.leaveHours', { hours: item?.stats?.leaveHours || 0 })}</div>
              <div>{t('stats.ot', { hours: item?.stats?.otHours || 0 })}</div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="raisePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.raisePercent')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={handlePercentChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="raiseAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.raiseAmount')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={handleAmountChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="newSsoWage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.newSsoWage')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      max={wageCap}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
