'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { userService, User } from '@/services/user.service';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface RoleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSuccess: () => void;
}

export function RoleEditDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: RoleEditDialogProps) {
  const t = useTranslations('Users');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    role: z.enum(['admin', 'hr', 'timekeeper']),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: user.role,
    },
  });

  // Update form default value when user prop changes
  useEffect(() => {
    if (user) {
      form.reset({ role: user.role });
    }
  }, [user, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      await userService.updateUserRole(user.id, values.role);
      toast({
        title: t('success.roleUpdated'),
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        variant: 'destructive',
        title: t('errors.updateFailed'),
        description: t('errors.updateFailedDescription'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('actions.editRole')}</DialogTitle>
          <DialogDescription>
            {t('editRoleDescription', { username: user.username })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.role')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholders.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="hr">{t('roles.hr')}</SelectItem>
                      <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                      <SelectItem value="timekeeper">{t('roles.timekeeper')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('actions.saving') : t('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
