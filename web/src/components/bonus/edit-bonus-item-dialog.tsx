'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { bonusService, BonusItem } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';
import { formatTenure } from '@/lib/format-tenure';

const editItemSchema = z.object({
  bonusMonths: z.coerce.number().min(0),
  bonusAmount: z.coerce.number().min(0),
});

type EditItemFormValues = z.infer<typeof editItemSchema>;

interface EditBonusItemDialogProps {
  item: BonusItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditBonusItemDialog({ item, open, onOpenChange, onSuccess }: EditBonusItemDialogProps) {
  const t = useTranslations('Bonus');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema) as any,
    defaultValues: {
      bonusMonths: 0,
      bonusAmount: 0,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        bonusMonths: item.bonusMonths || 0,
        bonusAmount: item.bonusAmount || 0,
      });
    }
  }, [item, form]);

  const currentSalary = item?.currentSalary || 0;

  const handleMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const months = parseFloat(e.target.value) || 0;
    const amount = currentSalary * months;
    form.setValue('bonusMonths', months);
    form.setValue('bonusAmount', parseFloat(amount.toFixed(2)));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    const months = currentSalary > 0 ? amount / currentSalary : 0;
    form.setValue('bonusAmount', amount);
    form.setValue('bonusMonths', parseFloat(months.toFixed(2)));
  };

  const onSubmit = async (data: EditItemFormValues) => {
    if (!item) return;
    try {
      setIsSubmitting(true);
      await bonusService.updateBonusItem(item.id, data);
      toast({
        title: t('editItem.saveSuccess'),
        variant: 'default',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update bonus item:', error);
      toast({
        title: tCommon('error'),
        description: t('editItem.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editItem.title', { name: item.employeeName })}</DialogTitle>
          <DialogDescription>{t('editItem.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-md mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{t('fields.currentSalary')}</span>
            <span className="text-sm">{currentSalary.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>{t('fields.bonusAmount')}</span>
            <span className="text-primary">{(form.watch('bonusAmount') || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('fields.tenure')}:</span>
            <span className="ml-2 font-medium">{formatTenure(item.tenureDays, t)}</span>
          </div>
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground">{t('fields.stats')}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>{t('stats.late')}: {item.stats?.lateMinutes || 0} {t('units.minutes')}</div>
              <div>{t('stats.leave')}: {item.stats?.leaveDays || 0} {t('units.days')}</div>
              <div>{t('stats.leaveDouble')}: {item.stats?.leaveDoubleDays || 0} {t('units.days')}</div>
              <div>{t('stats.leaveHours')}: {item.stats?.leaveHours || 0} {t('units.hours')}</div>
              <div>{t('stats.ot')}: {item.stats?.otHours || 0} {t('units.hours')}</div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bonusMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('editItem.bonusMonths')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={handleMonthsChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bonusAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('editItem.bonusAmount')}</FormLabel>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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
