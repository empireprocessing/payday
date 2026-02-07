"use client"

import { DashboardLayout } from '@/components/dashboard-layout'
import { StoresTable } from '@/components/stores-table'

export default function BoutiquesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold gradient-text">
            Gestion des Boutiques
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Gérez vos boutiques et leurs connexions PSP
          </p>
        </div>

        {/* Table des boutiques */}
        <StoresTable />
      </div>
    </DashboardLayout>
  )
}
