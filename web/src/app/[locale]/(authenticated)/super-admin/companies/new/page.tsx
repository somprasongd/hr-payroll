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

export default function NewCompanyPage() {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCompanyRequest>({
    companyCode: '',
    companyName: '',
    adminUsername: '',
    adminPassword: '',
  });

  const handleChange = (field: keyof CreateCompanyRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyCode || !formData.companyName || !formData.adminUsername || !formData.adminPassword) {
      toast({
        title: tCommon('error'),
        description: t('companies.validation.required'),
        variant: 'destructive',
      });
      return;
    }

    if (formData.adminPassword.length < 8) {
      toast({
        title: tCommon('error'),
        description: t('companies.validation.passwordLength'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await createCompany(formData);
      toast({
        title: tCommon('success'),
        description: t('companies.createSuccess'),
      });
      router.push('/super-admin/companies');
    } catch (error: any) {
      console.error('Failed to create company:', error);
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('companies.createError'),
        variant: 'destructive',
      });
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
                <Label htmlFor="companyCode">{t('companies.fields.code')} *</Label>
                <Input
                  id="companyCode"
                  value={formData.companyCode}
                  onChange={handleChange('companyCode')}
                  placeholder={t('companies.placeholders.code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">{t('companies.fields.name')} *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={handleChange('companyName')}
                  placeholder={t('companies.placeholders.name')}
                />
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
                    className="pl-10"
                    value={formData.adminUsername}
                    onChange={handleChange('adminUsername')}
                    placeholder={t('companies.placeholders.adminUsername')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">{t('companies.fields.adminPassword')} *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="adminPassword"
                    type="password"
                    className="pl-10"
                    value={formData.adminPassword}
                    onChange={handleChange('adminPassword')}
                    placeholder={t('companies.placeholders.adminPassword')}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('companies.passwordHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
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
