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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, Key, Trash } from 'lucide-react';
import { userService, User } from '@/services/user.service';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { PasswordResetDialog } from './password-reset-dialog';
import { RoleEditDialog } from './role-edit-dialog';

import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { Pagination } from '@/components/ui/pagination';

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

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.username')}</TableHead>
              <TableHead>{t('fields.role')}</TableHead>
              <TableHead>{t('fields.createdAt')}</TableHead>
              <TableHead>{t('fields.lastLoginAt')}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {t(`roles.${user.role}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {user.lastLoginAt
                    ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm')
                    : '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={user.id === currentUser?.id}>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">{t('actions.openMenu')}</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user);
                          setIsRoleEditOpen(true);
                        }}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {t('actions.editRole')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user);
                          setIsPasswordResetOpen(true);
                        }}
                      >
                        <Key className="mr-2 h-4 w-4" />
                        {t('actions.resetPassword')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteAlertOpen(true);
                        }}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        {t('actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
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
