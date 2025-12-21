'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from '@/i18n/routing';
import { listCompanies, Company } from '@/services/superadmin.service';
import { Badge } from '@/components/ui/badge';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

export default function CompaniesPage() {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const data = await listCompanies();
        setCompanies(data);
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        toast({
          title: tCommon('error'),
          description: t('fetchError'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">{t('status.active')}</Badge>;
      case 'suspended':
        return <Badge variant="secondary">{t('status.suspended')}</Badge>;
      case 'archived':
        return <Badge variant="outline">{t('status.archived')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<Company>[] = useMemo(() => [
    {
      accessorKey: 'code',
      header: t('companies.fields.code'),
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      header: t('companies.fields.name'),
    },
    {
      accessorKey: 'status',
      header: t('companies.fields.status'),
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'createdAt',
      header: t('companies.fields.createdAt'),
      cell: ({ row }) => format(new Date(row.original.createdAt), 'dd/MM/yyyy'),
    },
  ], [t]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<Company>[] = useMemo(() => [
    {
      label: tCommon('edit'),
      icon: <Pencil className="h-4 w-4" />,
      href: (company) => `/super-admin/companies/${company.id}`,
    },
  ], [tCommon]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {t('companies.title')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('companies.description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/super-admin/companies/new">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('companies.create')}</span>
          </Link>
        </Button>
      </div>

      <GenericDataTable
        data={companies}
        columns={columns}
        loading={loading}
        emptyStateText={t('companies.noData')}
        actions={actions}
      />
    </div>
  );
}
