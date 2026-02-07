"use client"

import { DashboardLayout } from '@/components/dashboard-layout'
import { PaymentsList } from '@/components/payments-list'

export default function PaiementsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold gradient-text">
            Paiements
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Historique de tous les paiements traités
          </p>
        </div>

        <PaymentsList />
      </div>
    </DashboardLayout>
  )
}
