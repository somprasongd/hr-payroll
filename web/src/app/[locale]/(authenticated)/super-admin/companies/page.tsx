'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Building2, MoreHorizontal, Pencil, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from '@/i18n/routing';
import { listCompanies, Company } from '@/services/superadmin.service';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('companies.fields.code')}</TableHead>
              <TableHead>{t('companies.fields.name')}</TableHead>
              <TableHead>{t('companies.fields.status')}</TableHead>
              <TableHead>{t('companies.fields.createdAt')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  {t('companies.noData')}
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.code}</TableCell>
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{getStatusBadge(company.status)}</TableCell>
                  <TableCell>
                    {format(new Date(company.createdAt), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/super-admin/companies/${company.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
