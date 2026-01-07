'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ArrowLeft, Building2, Save, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Link } from '@/i18n/routing';
import { createCompany, CreateCompanyRequest } from '@/services/superadmin.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';

export default function NewCompanyPage() {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast(); // Keep toast for success messages if needed, or replace entirely. User said "alert component like OTHER pages". OrgProfile uses DismissibleAlert for success too. But here we redirect. Let's keep toast for success before redirect for now, or just redirect. The plan said "Remove toast calls" for errors.

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateCompanyRequest>({
    companyName: '',
    adminUsername: '',
    adminPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateCompanyRequest, string>>>({});

  const handleChange = (field: keyof CreateCompanyRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error for this field
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    // Clear global error
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const newFieldErrors: Partial<Record<keyof CreateCompanyRequest, string>> = {};
    let hasError = false;

    if (!formData.companyName) {
      newFieldErrors.companyName = t('companies.validation.required');
      hasError = true;
    }
    if (!formData.adminUsername) {
      newFieldErrors.adminUsername = t('companies.validation.required');
      hasError = true;
    }
    if (!formData.adminPassword) {
      newFieldErrors.adminPassword = t('companies.validation.required');
      hasError = true;
    } else if (formData.adminPassword.length < 8) {
      newFieldErrors.adminPassword = t('companies.validation.passwordLength');
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newFieldErrors);
      return;
    }

    try {
      setLoading(true);
      await createCompany(formData);
      toast({
        title: tCommon('success'),
        description: t('companies.createSuccess'),
      });
      router.push('/super-admin/companies');
    } catch (error: any) {
      console.error('Failed to create company:', error);
      
      let description = error.response?.data?.detail || error.response?.data?.message || t('companies.createError');
      if (error.response?.status === 409) {
        if (error.response?.data?.detail === "duplicate admin user") {
          description = t('companies.errors.duplicateAdminUser');
        } else if (error.response?.data?.detail === "company code already exists") {
          description = t('companies.errors.duplicateCompanyCode');
        } else {
          description = error.response?.data?.detail || t('companies.errors.unknown');
        }
      } else if (error.response?.status === 500) {
        description = t('companies.errors.unknown');
      }

      setError(description);
      // Scroll to top to see error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/super-admin/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('companies.create')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('companies.createDescription')}
          </p>
        </div>
      </div>

      {error && (
        <DismissibleAlert
          variant="error"
          title={tCommon('error')}
          onDismiss={() => setError(null)}
          autoDismiss={false}
        >
          {error}
        </DismissibleAlert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('companies.companyInfo')}
            </CardTitle>
            <CardDescription>
              {t('companies.companyInfoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">{t('companies.fields.name')} *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={handleChange('companyName')}
                  placeholder={t('companies.placeholders.name')}
                  className={fieldErrors.companyName ? "border-red-500" : ""}
                />
                {fieldErrors.companyName && (
                  <p className="text-xs text-red-500">{fieldErrors.companyName}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('companies.adminInfo')}
            </CardTitle>
            <CardDescription>
              {t('companies.adminInfoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminUsername">{t('companies.fields.adminUsername')} *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="adminUsername"
                    className={`pl-10 ${fieldErrors.adminUsername ? "border-red-500" : ""}`}
                    value={formData.adminUsername}
                    onChange={handleChange('adminUsername')}
                    placeholder={t('companies.placeholders.adminUsername')}
                  />
                </div>
                {fieldErrors.adminUsername && (
                  <p className="text-xs text-red-500">{fieldErrors.adminUsername}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">{t('companies.fields.adminPassword')} *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="adminPassword"
                    type="password"
                    className={`pl-10 ${fieldErrors.adminPassword ? "border-red-500" : ""}`}
                    value={formData.adminPassword}
                    onChange={handleChange('adminPassword')}
                    placeholder={t('companies.placeholders.adminPassword')}
                  />
                </div>
                {fieldErrors.adminPassword ? (
                  <p className="text-xs text-red-500">{fieldErrors.adminPassword}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('companies.passwordHint')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/super-admin/companies">{tCommon('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
