'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MasterDataList, MasterDataForm } from '@/components/admin/master-data';
import { masterDataService } from '@/services/master-data.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function PositionsPage() {
  const t = useTranslations('Positions');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = async (data: { code: string; name: string }) => {
    await masterDataService.createPosition(data);
  };

  const handleCreated = () => {
    setIsCreateOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('createTitle')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createTitle')}</DialogTitle>
              <DialogDescription>
                {t('createDescription')}
              </DialogDescription>
            </DialogHeader>
            <MasterDataForm 
              type="position" 
              onSuccess={handleCreated} 
              onSubmit={handleCreate}
            />
          </DialogContent>
        </Dialog>
      </div>

      <MasterDataList type="position" key={refreshKey} />
    </div>
  );
}
