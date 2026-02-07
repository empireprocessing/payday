import { DashboardLayout } from '@/components/dashboard-layout';
import { PaymentManagement } from '@/components/payment-management';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PaymentManagementPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <PaymentManagement storeId={id} />
    </DashboardLayout>
  )
}
