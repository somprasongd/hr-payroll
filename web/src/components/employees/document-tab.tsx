'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Upload, Download, Trash2, FileText, Image, Loader2, Eye, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { 
  employeeDocumentService, 
  EmployeeDocument,
  UploadDocumentRequest 
} from '@/services/employee-document.service';
import { documentTypeService, DocumentType } from '@/services/document-type.service';

interface DocumentTabProps {
  employeeId: string;
}

export function DocumentTab({ employeeId }: DocumentTabProps) {
  const t = useTranslations('Documents');
  const locale = useLocale();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  
  // Max file size 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<EmployeeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContentType, setPreviewContentType] = useState<string>('');
  const [previewDocument, setPreviewDocument] = useState<EmployeeDocument | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docs, types] = await Promise.all([
        employeeDocumentService.list(employeeId),
        documentTypeService.list(),
      ]);
      setDocuments(docs);
      setDocumentTypes(types);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(t('fetchError'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async () => {
    if (!selectedFile || !selectedTypeId) {
      setUploadError(t('validation.fileAndTypeRequired'));
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const request: UploadDocumentRequest = {
        file: selectedFile,
        documentTypeId: selectedTypeId,
        documentNumber: documentNumber || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
      };

      await employeeDocumentService.upload(employeeId, request);
      
      // Reset and close
      resetUploadForm();
      setUploadDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Upload failed:', err);
      const message = err?.response?.data?.message || err?.message || t('uploadError');
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setSelectedTypeId('');
    setDocumentNumber('');
    setIssueDate('');
    setExpiryDate('');
    setNotes('');
    setUploadError(null);
    setFileSizeError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileSizeError(null);
    
    if (file && file.size > MAX_FILE_SIZE) {
      setFileSizeError(t('validation.fileTooLarge'));
      setSelectedFile(null);
      e.target.value = ''; // Reset the input
      return;
    }
    
    setSelectedFile(file);
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const blob = await employeeDocumentService.download(employeeId, doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handlePreview = async (doc: EmployeeDocument) => {
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);
      setPreviewContentType(doc.contentType);
      setPreviewDocument(doc);
      const url = await employeeDocumentService.downloadWithCache(employeeId, doc.id);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;
    
    try {
      setDeleting(true);
      await employeeDocumentService.delete(employeeId, documentToDelete.id);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <Image className="h-8 w-8 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeName = (doc: EmployeeDocument) => {
    return locale === 'th' ? doc.documentTypeNameTh : doc.documentTypeNameEn;
  };

  const getExpiryBadge = (doc: EmployeeDocument) => {
    if (!doc.expiryDate) return null;
    
    const expiry = new Date(doc.expiryDate);
    const today = new Date();
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return <Badge variant="destructive">{t('expired')}</Badge>;
    } else if (daysUntil <= 30) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{t('expiringDays', { days: daysUntil })}</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <DismissibleAlert
        variant="error"
        onDismiss={() => setError(null)}
        autoDismiss={false}
      >
        {error}
      </DismissibleAlert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button type="button" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('upload')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('noDocuments')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(doc.contentType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getTypeName(doc)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSizeBytes)}
                    </p>
                    {doc.expiryDate && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs">
                          {t('expiryLabel')}: {new Date(doc.expiryDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    <div className="mt-2">
                      {getExpiryBadge(doc)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-3">
                  {(doc.contentType.startsWith('image/') || doc.contentType === 'application/pdf') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePreview(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('preview')}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('download')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDocumentToDelete(doc);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('delete')}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('uploadDialog.title')}</DialogTitle>
            <DialogDescription>{t('uploadDialog.description')}</DialogDescription>
          </DialogHeader>

          {uploadError && (
            <DismissibleAlert
              variant="error"
              onDismiss={() => setUploadError(null)}
              autoDismiss={false}
            >
              {uploadError}
            </DismissibleAlert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">{t('uploadDialog.file')} *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              {fileSizeError && (
                <p className="text-xs text-destructive mt-1">{fileSizeError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {t('uploadDialog.fileHint')}
              </p>
            </div>

            <div>
              <Label htmlFor="type">{t('uploadDialog.type')} *</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('uploadDialog.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {locale === 'th' ? type.nameTh : type.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="documentNumber">{t('uploadDialog.documentNumber')}</Label>
              <Input
                id="documentNumber"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={t('uploadDialog.documentNumberPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="issueDate">{t('uploadDialog.issueDate')}</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="expiryDate">{t('uploadDialog.expiryDate')}</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">{t('uploadDialog.notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('uploadDialog.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleUpload} disabled={uploading || !selectedFile || !selectedTypeId}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('uploading')}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('upload')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('preview')}</DialogTitle>
            {previewDocument && (
              <DialogDescription>{previewDocument.fileName}</DialogDescription>
            )}
          </DialogHeader>
          
          {/* Document Metadata - Responsive */}
          {previewDocument && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">{t('uploadDialog.type')}:</span>{' '}
                <span className="font-medium">{getTypeName(previewDocument)}</span>
              </div>
              {previewDocument.documentNumber && (
                <div>
                  <span className="text-muted-foreground">{t('uploadDialog.documentNumber')}:</span>{' '}
                  <span className="font-medium">{previewDocument.documentNumber}</span>
                </div>
              )}
              {previewDocument.issueDate && (
                <div>
                  <span className="text-muted-foreground">{t('uploadDialog.issueDate')}:</span>{' '}
                  <span className="font-medium">{new Date(previewDocument.issueDate).toLocaleDateString(locale)}</span>
                </div>
              )}
              {previewDocument.expiryDate && (
                <div>
                  <span className="text-muted-foreground">{t('uploadDialog.expiryDate')}:</span>{' '}
                  <span className="font-medium">{new Date(previewDocument.expiryDate).toLocaleDateString(locale)}</span>
                  {getExpiryBadge(previewDocument)}
                </div>
              )}
              {previewDocument.notes && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t('uploadDialog.notes')}:</span>{' '}
                  <span className="font-medium">{previewDocument.notes}</span>
                </div>
              )}
            </div>
          )}
          
          {/* File Preview */}
          <div className="flex justify-center items-center min-h-[300px]">
            {previewLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : previewUrl ? (
              previewContentType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] border-0"
                  title="PDF Preview"
                />
              ) : (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain" />
              )
            ) : (
              <p className="text-muted-foreground">{t('previewError')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { name: documentToDelete?.fileName || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
