import { DashboardLayout } from '@/components/dashboard-layout';
import { PspAnalyticsComponent } from '@/components/psp-analytics';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PspAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <PspAnalyticsComponent pspId={id} />
    </DashboardLayout>
  )
}
