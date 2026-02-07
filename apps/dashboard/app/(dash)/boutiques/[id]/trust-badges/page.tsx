import { DashboardLayout } from '@/components/dashboard-layout';
import { TrustBadgesSettings } from '@/components/trust-badges-settings';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TrustBadgesPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <TrustBadgesSettings storeId={id} />
    </DashboardLayout>
  )
}
