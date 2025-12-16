'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AlertTriangle, FileText, Loader2, Clock, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { employeeDocumentService, ExpiringDocument } from '@/services/employee-document.service';

export function ExpiringDocumentsWidget() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpiringDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await employeeDocumentService.getExpiring(30);
      setDocuments(response.items || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch expiring documents:', err);
      setError(t('expiringDocuments.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchExpiringDocuments();
  }, [fetchExpiringDocuments]);

  const getDocumentTypeName = (doc: ExpiringDocument) => {
    return locale === 'th' ? doc.documentTypeNameTh : doc.documentTypeNameEn;
  };

  const getExpiryBadge = (daysUntilExpiry: number) => {
    if (daysUntilExpiry <= 0) {
      return <Badge variant="destructive">{t('expiringDocuments.expired')}</Badge>;
    } else if (daysUntilExpiry <= 7) {
      return <Badge className="bg-red-500 hover:bg-red-600">{t('expiringDocuments.days', { days: daysUntilExpiry })}</Badge>;
    } else if (daysUntilExpiry <= 14) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">{t('expiringDocuments.days', { days: daysUntilExpiry })}</Badge>;
    } else {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{t('expiringDocuments.days', { days: daysUntilExpiry })}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('expiringDocuments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('expiringDocuments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          {t('expiringDocuments.title')}
        </CardTitle>
        <CardDescription>
          {t('expiringDocuments.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('expiringDocuments.noExpiring')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.slice(0, 5).map((doc) => (
              <Link
                key={doc.documentId}
                href={`/employees/${doc.employeeId}?tab=documents`}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer block"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="rounded-full bg-muted p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {getDocumentTypeName(doc)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">
                        {doc.firstName} {doc.lastName}
                      </span>
                      <span className="text-muted-foreground/60">({doc.employeeNumber})</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(doc.expiryDate).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {getExpiryBadge(doc.daysUntilExpiry)}
                </div>
              </Link>
            ))}
            
            {documents.length > 5 && (
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/employees">
                    {t('expiringDocuments.viewAll', { count: documents.length })}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
