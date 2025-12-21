'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Edit2 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EditRaiseItemDialog } from './edit-raise-item-dialog';
import { SalaryRaiseItem } from '@/services/salary-raise.service';
import { formatTenure } from '@/lib/format-tenure';
import { EmployeePhoto } from '@/components/common/employee-photo';

interface SalaryRaiseItemsTableProps {
  items: SalaryRaiseItem[];
  cycleStatus: string;
  onRefresh: () => void;
}

export function SalaryRaiseItemsTable({ items, cycleStatus, onRefresh }: SalaryRaiseItemsTableProps) {
  const t = useTranslations('SalaryRaise');
  const [selectedItem, setSelectedItem] = useState<SalaryRaiseItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (item: SalaryRaiseItem) => {
    setSelectedItem(item);
    setEditOpen(true);
  };

  const isEditable = cycleStatus === 'pending';

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.employeeNumber')}</TableHead>
              <TableHead>{t('fields.employee')}</TableHead>
              <TableHead className="text-right">{t('fields.tenure')}</TableHead>
              <TableHead className="text-right">{t('fields.currentSalary')}</TableHead>
              <TableHead className="text-right">{t('fields.raisePercent')}</TableHead>
              <TableHead className="text-right">{t('fields.raiseAmount')}</TableHead>
              <TableHead className="text-right">{t('fields.newSalary')}</TableHead>
              <TableHead>{t('fields.stats')}</TableHead>
              {isEditable && <TableHead className="w-[70px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEditable ? 9 : 8} className="h-24 text-center">
                  {t('noItemsFound')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id || index}>
                  <TableCell className="font-medium text-muted-foreground">{item.employeeNumber || '-'}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                       <EmployeePhoto
                        photoId={item.photoId}
                        firstName={item.firstName}
                        lastName={item.lastName}
                        size="sm"
                        className="shrink-0"
                      />
                      <span>{item.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatTenure(item.tenureDays || 0, t)}</TableCell>
                  <TableCell className="text-right">
                    {(item.currentSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={(item.raisePercent || 0) > 0 ? 'default' : 'secondary'}>
                      {(item.raisePercent || 0).toFixed(2)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    +{(item.raiseAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {(item.newSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>{t('stats.late', { minutes: item.stats?.lateMinutes || 0 })}</div>
                      <div>{t('stats.leave', { days: item.stats?.leaveDays || 0 })}</div>
                      <div>{t('stats.leaveDouble', { days: item.stats?.leaveDoubleDays || 0 })}</div>
                      <div>{t('stats.leaveHours', { hours: item.stats?.leaveHours || 0 })}</div>
                      <div>{t('stats.ot', { hours: item.stats?.otHours || 0 })}</div>
                    </div>
                  </TableCell>
                  {isEditable && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditRaiseItemDialog
        item={selectedItem}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onRefresh}
      />
    </>
  );
}
