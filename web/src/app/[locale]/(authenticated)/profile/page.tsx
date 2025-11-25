'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { User, Mail, Shield, Calendar } from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { PasswordChangeForm } from '@/components/profile/password-change-form';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth-store';

interface UserProfile {
  id: string;
  username: string;
  role: string;
  lastLoginAt?: string;
}

export default function ProfilePage() {
  const t = useTranslations('Profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user: storedUser } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userData = await authService.me();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        // Fallback to stored user if API fails
        if (storedUser) {
            setUser(storedUser as UserProfile);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [storedUser]);

  if (loading) {
    return <div className="p-8 text-center">{t('loading')}</div>;
  }

  if (!user) {
    return <div className="p-8 text-center text-red-500">{t('errorLoadingProfile')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo')}</CardTitle>
            <CardDescription>{t('personalInfoDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{user.username}</h3>
                <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{t('username')}</p>
                  <p className="text-sm text-muted-foreground">{user.username}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{t('role')}</p>
                  <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
                </div>
              </div>

              {user.lastLoginAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{t('lastLogin')}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(user.lastLoginAt), 'PPpp')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <PasswordChangeForm />
      </div>
    </div>
  );
}
