'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { masterDataService, type MasterData } from '@/services/master-data.service';
import { ApiError } from '@/lib/api-client';
import { 
  Plus, 
  SquarePen, 
  Trash2,
  Loader2,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function PositionsPage() {
  const t = useTranslations('Positions');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  
  const [positions, setPositions] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterData | null>(null);
  const [deletingItem, setDeletingItem] = useState<MasterData | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({ code: '', name: '' });

  const fetchPositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await masterDataService.getPositions();
      // Handle null response from API (Go returns null for empty slices)
      setPositions(data ?? []);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ code: '', name: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: MasterData) => {
    setEditingItem(item);
    setFormData({ 
      code: item.code || item.Code || '', 
      name: item.name || item.Name || '' 
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (item: MasterData) => {
    setDeletingItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await masterDataService.updatePosition(editingItem.id, formData);
        toast({
          title: tCommon('success'),
          description: t('success.updated'),
        });
      } else {
        await masterDataService.createPosition(formData);
        toast({
          title: tCommon('success'),
          description: t('success.created'),
        });
      }
      setIsDialogOpen(false);
      fetchPositions();
    } catch (err) {
      const apiError = err as ApiError;
      toast({
        title: tCommon('error'),
        description: apiError.message || t('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      await masterDataService.deletePosition(deletingItem.id);
      toast({
        title: tCommon('success'),
        description: t('success.deleted'),
      });
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchPositions();
    } catch (err) {
      const apiError = err as ApiError;
      toast({
        title: tCommon('error'),
        description: apiError.message || t('errors.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createTitle')}
        </Button>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon('error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.code')}</TableHead>
                <TableHead>{t('fields.name')}</TableHead>
                <TableHead className="w-[120px]">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code || item.Code}</TableCell>
                  <TableCell>{item.name || item.Name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {positions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t('editTitle') : t('createTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? t('editDescription') : t('createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t('fields.code')}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder={t('placeholders.code')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t('fields.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('placeholders.name')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.code.trim() || !formData.name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tCommon('saving')}
                </>
              ) : (
                tCommon('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tCommon('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
