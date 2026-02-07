import { DashboardLayout } from '@/components/dashboard-layout';
import { ShippingSettings } from '@/components/shipping-settings';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ShippingSettingsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <ShippingSettings storeId={id} />
    </DashboardLayout>
  )
}
