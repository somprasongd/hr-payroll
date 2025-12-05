'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { Button } from '@/components/ui/button';
import { Shield, Key, Trash } from 'lucide-react';
import { userService, User } from '@/services/user.service';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { PasswordResetDialog } from './password-reset-dialog';
import { RoleEditDialog } from './role-edit-dialog';

import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';

export function UserList() {
  const t = useTranslations('Users');
  const { toast } = useToast();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isRoleEditOpen, setIsRoleEditOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await userService.getUsers({
        page: currentPage,
        limit: 20
      });
      setUsers(response.data);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        variant: 'destructive',
        title: t('errors.fetchFailed'),
        description: t('errors.fetchFailedDescription'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await userService.deleteUser(selectedUser.id);
      toast({
        title: t('success.userDeleted'),
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        variant: 'destructive',
        title: t('errors.deleteFailed'),
        description: t('errors.deleteFailedDescription'),
      });
    } finally {
      setIsDeleteAlertOpen(false);
      setSelectedUser(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const columns = [
    {
      id: 'username',
      header: t('fields.username'),
      accessorFn: (row: User) => row.username,
      cell: (info: any) => <span className="font-medium">{info.getValue()}</span>,
    },
    {
      id: 'role',
      header: t('fields.role'),
      accessorFn: (row: User) => row.role,
      cell: (info: any) => (
        <Badge variant={info.getValue() === 'admin' ? 'default' : 'secondary'}>
          {t(`roles.${info.getValue()}`)}
        </Badge>
      ),
    },
    {
      id: 'createdAt',
      header: t('fields.createdAt'),
      accessorFn: (row: User) => row.createdAt,
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'lastLoginAt',
      header: t('fields.lastLoginAt'),
      accessorFn: (row: User) => row.lastLoginAt,
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm') : '-',
    },
  ];

  const actions = [
    {
      label: t('actions.editRole'),
      icon: <Shield className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setIsRoleEditOpen(true);
      },
      condition: (user: User) => user.id !== currentUser?.id,
    },
    {
      label: t('actions.resetPassword'),
      icon: <Key className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setIsPasswordResetOpen(true);
      },
      condition: (user: User) => user.id !== currentUser?.id,
    },
    {
      label: t('actions.delete'),
      icon: <Trash className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (user: User) => {
        setSelectedUser(user);
        setIsDeleteAlertOpen(true);
      },
      condition: (user: User) => user.id !== currentUser?.id,
    },
  ];

  return (
    <>
      <GenericDataTable
        data={users}
        columns={columns}
        loading={isLoading}
        emptyStateText={t('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange
        }}
      />

      {selectedUser && (
        <>
          <PasswordResetDialog
            open={isPasswordResetOpen}
            onOpenChange={setIsPasswordResetOpen}
            userId={selectedUser.id}
            username={selectedUser.username}
          />
          <RoleEditDialog
            open={isRoleEditOpen}
            onOpenChange={setIsRoleEditOpen}
            user={selectedUser}
            onSuccess={fetchUsers}
          />
          <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
                <DialogDescription>
                  {t('deleteConfirmDescription', { username: selectedUser.username })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteUser}
                >
                  {t('actions.delete')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
