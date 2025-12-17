'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';

interface DocumentTypeFormProps {
  initialData?: { code: string; nameTh: string; nameEn: string };
  onSuccess: () => void;
  onSubmit: (data: { code: string; nameTh: string; nameEn: string }) => Promise<void>;
}

export function DocumentTypeForm({ initialData, onSuccess, onSubmit }: DocumentTypeFormProps) {
  const t = useTranslations('DocumentTypes');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    code: z.string().min(1, 'Required'),
    nameTh: z.string().min(1, 'Required'),
    nameEn: z.string().min(1, 'Required'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: initialData?.code || '',
      nameTh: initialData?.nameTh || '',
      nameEn: initialData?.nameEn || '',
    },
  });

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      await onSubmit(values);
      toast({
        title: tCommon('success'),
        description: initialData ? t('success.updated') : t('success.created'),
      });
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to save:', error);
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.message || t('errors.saveFailed'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.code')}</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t('placeholders.code')} 
                  {...field} 
                  disabled={!!initialData}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nameTh"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.nameTh')}</FormLabel>
              <FormControl>
                <Input placeholder={t('placeholders.nameTh')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nameEn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.nameEn')}</FormLabel>
              <FormControl>
                <Input placeholder={t('placeholders.nameEn')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {tCommon('saving')}
              </>
            ) : (
              tCommon('save')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
