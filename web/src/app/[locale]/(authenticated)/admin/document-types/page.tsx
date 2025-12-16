'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentTypeList, DocumentTypeForm } from '@/components/admin/document-types';
import { documentTypeService } from '@/services/document-type.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function DocumentTypesPage() {
  const t = useTranslations('DocumentTypes');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = async (data: { code: string; nameTh: string; nameEn: string }) => {
    await documentTypeService.create(data);
  };

  const handleCreated = () => {
    setIsCreateOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
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
            <DocumentTypeForm 
              onSuccess={handleCreated} 
              onSubmit={handleCreate}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DocumentTypeList key={refreshKey} />
    </div>
  );
}
