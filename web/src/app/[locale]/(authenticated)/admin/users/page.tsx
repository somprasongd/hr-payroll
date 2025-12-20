'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { UserList } from '@/components/admin/users/user-list';
import { UserForm } from '@/components/admin/users/user-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function UsersPage() {
  const t = useTranslations('Users');
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUserCreated = (userId: string) => {
    setIsCreateOpen(false);
    setRefreshKey((prev) => prev + 1);
    // Redirect to branch management page for the new user
    router.push(`/admin/users/${userId}/branches`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('description')}
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('createUser')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createUser')}</DialogTitle>
              <DialogDescription>
                {t('createUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <UserForm onSuccess={handleUserCreated} />
          </DialogContent>
        </Dialog>
      </div>

      <UserList key={refreshKey} />
    </div>
  );
}
