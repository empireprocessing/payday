"use client"

import { useState } from "react"
import { DashboardLayout } from '@/components/dashboard-layout'
import { PSPTable } from '@/components/psp-table'
import { PspListManager } from '@/components/psp-list-manager'
import { Button } from '@/components/ui/button'

export default function PSPPage() {
  const [activeTab, setActiveTab] = useState<"lists" | "psps">("psps")

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold gradient-text">
            Gestion des PSP
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Gérez vos fournisseurs de services de paiement
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 border-b">
          <Button
            variant={activeTab === "psps" ? "default" : "ghost"}
            onClick={() => setActiveTab("psps")}
            className="rounded-b-none"
          >
            Tous les PSP
          </Button>
          <Button
            variant={activeTab === "lists" ? "default" : "ghost"}
            onClick={() => setActiveTab("lists")}
            className="rounded-b-none"
          >
            Listes de PSP
          </Button>
        </div>

        {/* Content */}
        {activeTab === "lists" ? (
          <PspListManager />
        ) : (
        <PSPTable />
        )}
      </div>
    </DashboardLayout>
  )
}
