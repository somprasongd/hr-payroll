'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'my', name: 'မြန်မာ', flag: '🇲🇲' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // Save the selected language to localStorage and cookie
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', newLocale);
      // Set cookie for server-side access
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1 year
    }
    router.replace(pathname, { locale: newLocale as 'en' | 'th' | 'my' });
  };

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px]">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
