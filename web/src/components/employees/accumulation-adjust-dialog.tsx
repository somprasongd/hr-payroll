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
import { accumulationService } from '@/services/accumulation.service';

const formSchema = z.object({
  accumType: z.string(),
  accumYear: z.coerce.number().optional(),
  amount: z.coerce.number().min(0),
});

interface AccumulationAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  type: string;
  year?: number;
  currentAmount: number;
  onSuccess: () => void;
}

export function AccumulationAdjustDialog({
  open,
  onOpenChange,
  employeeId,
  type,
  year,
  currentAmount,
  onSuccess,
}: AccumulationAdjustDialogProps) {
  const t = useTranslations('Accumulation');
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      accumType: type,
      accumYear: year,
      amount: currentAmount,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        accumType: type,
        accumYear: year,
        amount: currentAmount,
      });
    }
  }, [open, type, year, currentAmount, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSaving(true);
      await accumulationService.upsertAccumulation(employeeId, {
        accumType: values.accumType,
        accumYear: values.accumYear,
        amount: values.amount,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adjustTitle')}</DialogTitle>
          <DialogDescription>
            {type && t('adjustDescription', { type: t(`types.${type}`) })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('amount')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
