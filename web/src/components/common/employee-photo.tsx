'use client';

import { useState, useEffect } from 'react';
import { employeeService } from '@/services/employee.service';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface EmployeePhotoProps {
  photoId?: string;
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-24 w-24',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-10 w-10',
};

export function EmployeePhoto({ photoId, firstName, lastName, size = 'md', className }: EmployeePhotoProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!photoId) {
      setPhotoUrl(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    employeeService.fetchPhotoWithCache(photoId).then((url) => {
      if (isMounted) {
        setPhotoUrl(url);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [photoId]);

  // Get initials from firstName and lastName
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.trim()?.[0] || '';
    const last = lastName?.trim()?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const initials = getInitials(firstName, lastName);
  const altText = [firstName, lastName].filter(Boolean).join(' ') || 'Employee Photo';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {photoUrl ? (
        <AvatarImage src={photoUrl} alt={altText} className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-muted">
        {loading ? (
          <div className={cn('animate-pulse bg-muted-foreground/20 rounded-full', sizeClasses[size])} />
        ) : initials ? (
          <span className="text-xs font-medium">{initials}</span>
        ) : (
          <User className={cn('text-muted-foreground', iconSizes[size])} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
