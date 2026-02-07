import { requireAuth } from "@/lib/actions"

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Vérifier l'authentification pour toutes les pages du dashboard
  await requireAuth()

  return <>{children}</>
}
