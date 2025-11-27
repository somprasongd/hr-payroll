import { DebtDetail } from '@/components/debt/debt-detail';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DebtDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <DebtDetail id={id} />;
}
