import { DashboardLayout } from '@/components/dashboard-layout';
import { MetaConversionSettings } from '@/components/meta-conversion-settings';

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function MetaSettingsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <MetaConversionSettings storeId={id} />
    </DashboardLayout>
  )
}
