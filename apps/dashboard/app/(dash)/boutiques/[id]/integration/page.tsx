import { DashboardLayout } from '@/components/dashboard-layout';
import { WooCommerceIntegration } from '@/components/woocommerce-integration';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <WooCommerceIntegration storeId={id} />
    </DashboardLayout>
  )
}
