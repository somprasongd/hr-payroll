'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Link, useRouter } from '@/i18n/routing';
import { getCompany, updateCompany, Company } from '@/services/superadmin.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CompanyDetailPage() {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    status: 'active',
  });

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const data = await getCompany(id);
        setCompany(data);
        setFormData({
          code: data.code,
          name: data.name,
          status: data.status,
        });
      } catch (error) {
        console.error('Failed to fetch company:', error);
        toast({
          title: tCommon('error'),
          description: t('fetchError'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchCompany();
    }
  }, [id]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast({
        title: tCommon('error'),
        description: t('companies.validation.required'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await updateCompany(id, formData);
      toast({
        title: tCommon('success'),
        description: t('companies.updateSuccess'),
      });
      router.push('/super-admin/companies');
    } catch (error: any) {
      console.error('Failed to update company:', error);
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('companies.updateError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        {tCommon('loading')}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20">
        {t('companies.notFound')}
      </div>
    );
  }

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
            {t('companies.edit')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {company.code} - {company.name}
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
                <Label htmlFor="code">{t('companies.fields.code')} *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={handleChange('code')}
                  placeholder={t('companies.placeholders.code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t('companies.fields.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder={t('companies.placeholders.name')}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t('companies.fields.status')}</Label>
                <Select value={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('status.active')}</SelectItem>
                    <SelectItem value="suspended">{t('status.suspended')}</SelectItem>
                    <SelectItem value="archived">{t('status.archived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/super-admin/companies">{tCommon('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
