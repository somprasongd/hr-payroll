import { useTranslations } from 'next-intl';
import { SalaryRaiseCycleList } from '@/components/salary-raise/salary-raise-cycle-list';

export default function SalaryRaisePage() {
  const t = useTranslations('SalaryRaise');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>
      <SalaryRaiseCycleList />
    </div>
  );
}
