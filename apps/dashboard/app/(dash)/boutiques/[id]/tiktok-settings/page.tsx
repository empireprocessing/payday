import { DashboardLayout } from '@/components/dashboard-layout';
import { TiktokPixelSettings } from '@/components/tiktok-pixel-settings';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TiktokSettingsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <TiktokPixelSettings storeId={id} />
    </DashboardLayout>
  )
}
