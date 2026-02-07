import { DashboardLayout } from '@/components/dashboard-layout';
import { StoreAnalyticsComponent } from '@/components/store-analytics';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function StoreAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <StoreAnalyticsComponent storeId={id} />
    </DashboardLayout>
  )
}
