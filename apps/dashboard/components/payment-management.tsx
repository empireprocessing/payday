"use client"

import { useState, useEffect } from "react"
import * as React from "react"
import { apiClient, useApiError } from "@/lib/api-client"
import type { StoreAnalytics } from "@/lib/api-client"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PSPConfigurationTable } from "./psp-configuration-table"
import { PaymentFlowVisualization } from "./payment-flow-visualization"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

import {
    ArrowLeft,
    CreditCard,
    Settings,
    Shuffle,
    TrendingUp,
    DollarSign,
    Plus,
    X
} from "lucide-react"

interface PaymentManagementProps {
  storeId: string
}



export function PaymentManagement({ storeId }: PaymentManagementProps) {
  const [storeData, setStoreData] = useState<StoreAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routingMode, setRoutingMode] = useState<"automatic" | "manual">("automatic")
  const [weights, setWeights] = useState<{[pspId: string]: number}>({})
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [isFallbackConfigOpen, setIsFallbackConfigOpen] = useState(false)
  const [isSavingRouting, setIsSavingRouting] = useState(false)
  const [isSavingFallback, setIsSavingFallback] = useState(false)
  const [fallbackConfig, setFallbackConfig] = useState({
    enabled: true,
    maxRetries: 2,
    psps: [] as Array<{ id: string, name: string, order: number }>
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allPsps, setAllPsps] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [configuredPsps, setConfiguredPsps] = useState<any[]>([])

  const { handleError } = useApiError()

  // Fonction pour mettre à jour les états locaux avec les données de l'API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateLocalStatesFromAnalytics = (analytics: any) => {
    if (analytics.routing) {
      // Mettre à jour le mode de routing
      setRoutingMode(analytics.routing.mode?.toLowerCase() === 'manual' ? 'manual' : 'automatic')
      
      // Mettre à jour les poids
      const weightsObj: {[pspId: string]: number} = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      analytics.routing.weights.forEach((weight: any) => {
        weightsObj[weight.pspId] = weight.weight
      })
      setWeights(weightsObj)

      // Mettre à jour le fallback
      setFallbackConfig({
        enabled: analytics.routing.fallbackEnabled ?? false,
        maxRetries: analytics.routing.maxRetries ?? 2,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        psps: analytics.routing.fallbackSequence.map((seq: any) => ({
          id: seq.pspId,
          name: seq.pspName,
          order: seq.order
        }))
      })
    }
  }

  // Fonction pour recharger les données de la boutique
  const loadStoreData = React.useCallback(async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Charger les analytics de la boutique, tous les PSP ET les PSP configurés
        const [analytics, allPspsData, configuredPspsData] = await Promise.all([
          apiClient.analytics.getStoreAnalytics(storeId, 'month'),
          apiClient.psps.getAll(),
          apiClient.storePsp.getByStore(storeId)
        ])
        
        setStoreData(analytics)
        setAllPsps(allPspsData)
        setConfiguredPsps(configuredPspsData)

        // Configurer le routing mode et les poids depuis les données
        updateLocalStatesFromAnalytics(analytics)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Une erreur est survenue')
        }
        console.error('Failed to load store data:', err)
      } finally {
        setLoading(false)
      }
  }, [storeId])

  // Charger les données de la boutique depuis l'API
  useEffect(() => {
    loadStoreData()
  }, [loadStoreData])

  // Écouter les événements de modification de liste pour rafraîchir automatiquement
  useEffect(() => {
    const handleListUpdate = () => {
      // Rafraîchir les données après un court délai pour laisser le temps à la synchronisation
      setTimeout(() => {
        loadStoreData()
      }, 1000)
    }

    // Écouter les événements personnalisés de modification de liste
    window.addEventListener('psp-list-updated', handleListUpdate)
    
    return () => {
      window.removeEventListener('psp-list-updated', handleListUpdate)
    }
  }, [loadStoreData])
  
  // PSP disponibles pour les suggestions (TOUS les PSP actifs, pas seulement ceux de la boutique)
  const availablePsps = allPsps
    .filter(psp => !psp.deletedAt && psp.isActive) // Exclure les PSP archivés
    .filter(psp => !fallbackConfig.psps.some(fp => fp.id === psp.id))
    .map(psp => ({
      id: psp.id,
      name: psp.name,
      logo: `/${psp.pspType}.png`
    }))
  
  const [pspSearchInput, setPspSearchInput] = useState("")
  const [showPspSuggestions, setShowPspSuggestions] = useState(false)

  const [isPspConfigOpen, setIsPspConfigOpen] = useState(false)
  const [isSavingPsp, setIsSavingPsp] = useState(false)



  // Utiliser les PSP configurés au lieu des PSP actifs (qui ne contiennent que ceux avec des données)
  const activePsps = configuredPsps.map(storePsp => ({
    id: storePsp.psp.id,
    name: storePsp.psp.name,
    pspType: storePsp.psp.pspType,
    totalPayments: 0, // Pas de données de paiement pour les nouveaux PSP
    successfulPayments: 0,
    totalRevenue: 0,
    conversionRate: 0
  }))
  const totalVolume = activePsps.reduce((sum, psp) => sum + psp.totalRevenue, 0)
  

  // Calculer le total en temps réel pour les PSP actifs seulement
  const totalWeight = activePsps.reduce((sum, psp) => sum + (weights[psp.id] || 0), 0)

  const handleWeightChange = (pspId: string, newWeight: number) => {
    const otherPsps = activePsps.filter(psp => psp.id !== pspId)
    const otherPspsCount = otherPsps.length
    
    if (otherPspsCount === 0) {
      setWeights({ [pspId]: 100 })
      return
    }

    const currentWeight = weights[pspId] || 0
    const weightDifference = newWeight - currentWeight
    const newWeights = { ...weights, [pspId]: newWeight }
    
    // Si on augmente le poids
    if (weightDifference > 0) {
      // Trier les autres PSP par poids décroissant pour réduire d'abord les plus élevés
      const sortedOtherPsps = [...otherPsps].sort((a, b) => 
        (weights[b.id] || 0) - (weights[a.id] || 0)
      )
      
      let remainingReduction = weightDifference
      
      // Réduire proportionnellement les autres PSP, en commençant par le plus élevé
      for (const psp of sortedOtherPsps) {
        const currentPspWeight = weights[psp.id] || 0
        if (currentPspWeight <= 0) continue
        
        // Calculer la réduction proportionnelle
        const totalOtherWeight = sortedOtherPsps.reduce((sum, p) => sum + (weights[p.id] || 0), 0)
        const proportion = currentPspWeight / totalOtherWeight
        const reduction = Math.min(remainingReduction * proportion, currentPspWeight)
        
        newWeights[psp.id] = Math.max(0, currentPspWeight - Math.round(reduction))
        remainingReduction -= reduction
        
        if (remainingReduction <= 0) break
      }
    }
    // Si on diminue le poids
    else if (weightDifference < 0) {
      const excessWeight = Math.abs(weightDifference)
      
      // Trier les autres PSP par poids croissant pour augmenter d'abord les plus faibles
      const sortedOtherPsps = [...otherPsps].sort((a, b) => 
        (weights[a.id] || 0) - (weights[b.id] || 0)
      )
      
      let remainingIncrease = excessWeight
      
      // Augmenter proportionnellement les autres PSP, en commençant par le plus faible
      for (const psp of sortedOtherPsps) {
        const currentPspWeight = weights[psp.id] || 0
        
        // Calculer l'augmentation proportionnelle (favoriser les plus faibles)
        const totalOtherWeight = sortedOtherPsps.reduce((sum, p) => sum + (weights[p.id] || 0), 0)
        const inverseProportion = (totalOtherWeight - currentPspWeight) / totalOtherWeight
        const increase = Math.min(remainingIncrease * inverseProportion, 100 - currentPspWeight)
        
        newWeights[psp.id] = Math.min(100, currentPspWeight + Math.round(increase))
        remainingIncrease -= increase
        
        if (remainingIncrease <= 0) break
      }
    }
    
    // Normaliser pour que le total soit 100%
    const total = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0)
    if (total !== 100) {
      const adjustment = 100 - total
      newWeights[pspId] = Math.max(0, newWeights[pspId] + adjustment)
    }
    
    setWeights(newWeights)
  }

  // Handlers pour la table PSP
  const handleAddPsp = async (pspIds: string[]) => {
    console.log('Synchronizing PSPs:', pspIds)
    
    try {
      setIsSavingPsp(true)
      
      // Identifier les PSP déjà configurés (par ID global)
      const configuredPspIds = activePsps.map(psp => psp.id)
      console.log('Configured PSP IDs:', configuredPspIds)
      
      // PSP à ajouter (nouveaux)
      const pspIdsToAdd = pspIds.filter(id => !configuredPspIds.includes(id))
      
      // PSP à supprimer (plus cochés)
      const pspIdsToRemove = configuredPspIds.filter(id => !pspIds.includes(id))
      
      console.log('PSP IDs to add:', pspIdsToAdd)
      console.log('PSP IDs to remove:', pspIdsToRemove)
      
      // Ajouter les nouveaux PSP
      for (const pspId of pspIdsToAdd) {
        console.log('Adding PSP:', pspId)
        await apiClient.storePsp.link(storeId, pspId)
      }
      
      // Supprimer les PSP non cochés
      for (const pspId of pspIdsToRemove) {
        console.log('Removing PSP:', pspId)
        await apiClient.storePsp.unlink(storeId, pspId)
      }

      // Recharger les données pour voir les changements
      const [analytics, allPspsData, configuredPspsData] = await Promise.all([
        apiClient.analytics.getStoreAnalytics(storeId, 'month'),
        apiClient.psps.getAll(),
        apiClient.storePsp.getByStore(storeId)
      ])
      
      setStoreData(analytics)
      setAllPsps(allPspsData)
      setConfiguredPsps(configuredPspsData)
      
      // Mettre à jour les états locaux
      updateLocalStatesFromAnalytics(analytics)
      
      // Fermer le modal et afficher un toast
      setIsPspConfigOpen(false)
      
      // Afficher le résumé des actions
      if (pspIdsToAdd.length > 0 && pspIdsToRemove.length > 0) {
        toast.success(`${pspIdsToAdd.length} PSP ajouté(s), ${pspIdsToRemove.length} PSP supprimé(s)`)
      } else if (pspIdsToAdd.length > 0) {
        toast.success(`${pspIdsToAdd.length} PSP ajouté(s)`)
      } else if (pspIdsToRemove.length > 0) {
        toast.success(`${pspIdsToRemove.length} PSP supprimé(s)`)
      } else {
        toast.info('Aucun changement effectué')
      }
      
      console.log('PSPs synchronized successfully')
    } catch (err) {
      console.error('Failed to sync PSPs:', err)
      setError('Erreur lors de la synchronisation des PSP')
      toast.error('Erreur lors de la synchronisation des PSP')
    } finally {
      setIsSavingPsp(false)
    }
  }

  const handleRemovePsp = async (pspId: string) => {
    console.log('Removing PSP:', pspId)
    // TODO: Implémenter la suppression de PSP
    try {
      await apiClient.psps.delete(pspId)
      // Recharger les données
      const [analytics, configuredPspsData] = await Promise.all([
        apiClient.analytics.getStoreAnalytics(storeId, 'month'),
        apiClient.storePsp.getByStore(storeId)
      ])
      setStoreData(analytics)
      setConfiguredPsps(configuredPspsData)
      toast.success('PSP supprimé avec succès')
    } catch (err) {
      console.error('Failed to remove PSP:', err)
      toast.error('Erreur lors de la suppression du PSP')
    }
  }



  // Affichage du loading
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              Gestion des Paiements
            </h1>
            <p className="text-muted-foreground">
              Chargement...
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="px-6 py-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted/30"></div>
                  <div>
                    <div className="h-6 w-16 bg-muted/30 rounded mb-2"></div>
                    <div className="h-4 w-20 bg-muted/30 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Affichage des erreurs
  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              Gestion des Paiements
            </h1>
          </div>
        </div>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <p className="text-destructive font-medium">Erreur de chargement</p>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  if (!storeData) {
    return null
  }

  return (
    <div className="space-y-8">
      <style jsx global>{`
        .react-flow__controls {
          --xy-controls-button-background-color-default: hsl(var(--background));
          --xy-controls-button-background-color-hover-default: hsl(var(--muted));
          --xy-controls-button-color-default: hsl(var(--foreground));
          --xy-controls-button-color-hover-default: hsl(var(--foreground));
          --xy-controls-button-border-color-default: hsl(var(--border));
          --xy-controls-box-shadow-default: 0 0 2px 1px hsl(var(--border) / 0.2);
        }
        .react-flow__attribution {
          display: none !important;
        }

      `}</style>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/boutiques">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            Gestion des Paiements
          </h1>
          <p className="text-muted-foreground">
            {storeData?.store.name || 'Chargement...'} • {storeData?.store.domain || ''}
          </p>
        </div>
      </div>

      {/* Métriques Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="px-6 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20">
                <CreditCard className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{storeData?.store.activePsps || 0}</p>
                <p className="text-sm text-muted-foreground">PSP Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activePsps.reduce((sum, psp) => sum + psp.totalPayments, 0)}</p>
                <p className="text-sm text-muted-foreground">Paiements</p>
                
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20">
                <DollarSign className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">€{(totalVolume/100).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Revenus Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20">
                <Shuffle className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold capitalize">{routingMode === "automatic" ? "Automatique" : "Manuel"}</p>
                <p className="text-sm text-muted-foreground">Stratégie</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PSP Actifs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                PSP Configurés
              </CardTitle>
              <Button size="sm" onClick={() => setIsPspConfigOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurer
                </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePsps.length === 0 ? (
              <div className="text-center py-4">
                <h3 className="font-medium text-base mb-1">Aucun PSP configuré</h3>
                <p className="text-xs text-muted-foreground">
                  Configurez vos prestataires de services de paiement.
                </p>
              </div>
            ) : (
                              <div className="relative">
                  <div className="max-h-24 overflow-y-auto space-y-3 [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
                    {activePsps.map((psp) => (
                  <div 
                    key={psp.id}
                    className="p-2 rounded-lg border border-border bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={`/${psp.pspType}.png`}
                        alt={psp.name}
                        width={20}
                        height={20}
                        className="rounded"
                      />
                      <div className="font-medium text-sm">{psp.name}</div>
                    </div>
                  </div>
                ))}
                  </div>
                </div>
            )}
            

            
            {/* Modal Configuration PSP */}
            <Dialog open={isPspConfigOpen} onOpenChange={setIsPspConfigOpen}>
              <DialogContent className="border-primary/20 !max-w-2xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Configuration des PSP</DialogTitle>
                </DialogHeader>
                
                  <PSPConfigurationTable 
                    storeId={storeId}
                    configuredPspIds={activePsps.map(psp => psp.id)}
                    onAddPsp={handleAddPsp}
                    onRemovePsp={handleRemovePsp}
                    isSaving={isSavingPsp}
                    onListApplied={async () => {
                      // Rafraîchir les données après l'application d'une liste
                      try {
                        const [analytics, allPspsData, configuredPspsData] = await Promise.all([
                          apiClient.analytics.getStoreAnalytics(storeId, 'month'),
                          apiClient.psps.getAll(),
                          apiClient.storePsp.getByStore(storeId)
                        ])
                        setStoreData(analytics)
                        setAllPsps(allPspsData)
                        setConfiguredPsps(configuredPspsData)
                        updateLocalStatesFromAnalytics(analytics)
                      } catch (err) {
                        console.error('Failed to refresh data after list application:', err)
                      }
                    }}
                  />
              </DialogContent>
            </Dialog>


          </CardContent>
        </Card>

        {/* Stratégie de Routing */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Stratégie de Routing
              </CardTitle>
              <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-primary/20 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configuration de la Stratégie de Routing</DialogTitle>
                  </DialogHeader>
                  
                  <div className="py-4">
                    {/* Tabs Navigation */}
                    <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-6">
                      <button
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          routingMode === "automatic" 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setRoutingMode("automatic")}
                      >
                        Automatique
                      </button>
                      <button
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          routingMode === "manual" 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setRoutingMode("manual")}
                      >
                        Manuel
                      </button>
                    </div>

                    {routingMode === "automatic" && (
                      <div className="space-y-4">
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="default">Smart Routing</Badge>
                            <Badge variant="outline">Actif</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Le système optimise automatiquement le routing en fonction des performances, taux de succès, et conditions de paiement en temps réel.
                          </p>
                        </div>

                        <div className="p-4 border rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">Optimisation en cours</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            PAYDAY analyse continuellement les performances de vos PSP pour router intelligemment chaque transaction.
                          </p>
                        </div>
                      </div>
                    )}

                    {routingMode === "manual" && (
                      <div className="space-y-4">
                        <div className="p-4 bg-orange/10 rounded-lg border border-orange/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-orange-500 text-orange-400">
                              Répartition par poids
                            </Badge>
                            <Badge 
                              variant={totalWeight === 100 ? "default" : "destructive"}
                              className={totalWeight === 100 ? "bg-green-500/20 text-green-400" : ""}
                            >
                              Total: {totalWeight}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {totalWeight === 100 
                              ? "Répartition aléatoire pondérée selon les poids définis"
                              : "⚠️ La somme des poids doit être égale à 100%"
                            }
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Distribution des poids</h4>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const equalWeight = Math.floor(100 / activePsps.length)
                                const remainder = 100 % activePsps.length
                                const newWeights: {[pspId: string]: number} = {}
                                
                                activePsps.forEach((psp, index) => {
                                  newWeights[psp.id] = equalWeight + (index < remainder ? 1 : 0)
                                })
                                
                                setWeights(newWeights)
                              }}
                            >
                              Répartir équitablement
                            </Button>
                          </div>
                          {activePsps.map((psp) => (
                            <div key={psp.id} className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Image
                                    src={`/${psp.pspType}.png`}
                                    alt={psp.name}
                                    width={24}
                                    height={24}
                                    className="rounded"
                                  />
                                  <div>
                                    <div className="font-medium">{psp.name}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">{weights[psp.id] || 0}%</div>
                                </div>
                              </div>
                              
                              {/* Slider */}
                              <div className="space-y-2">
                                <Slider
                                  value={[weights[psp.id] || 0]}
                                  onValueChange={(value) => handleWeightChange(psp.id, value[0])}
                                  max={100}
                                  step={1}
                                  className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button 
                                          onClick={async () => {
                        try {
                          setIsSavingRouting(true)
                          const configData = {
                            mode: routingMode.toUpperCase() as 'AUTOMATIC' | 'MANUAL',
                            fallbackEnabled: fallbackConfig.enabled,
                            maxRetries: fallbackConfig.maxRetries,
                            weights: routingMode === 'manual' ? Object.entries(weights).map(([pspId, weight]) => ({ pspId, weight })) : undefined,
                          }
                          
                          await apiClient.routing.updateConfig(storeId, configData)
                          
                          // Recharger les données
                          const [analytics, configuredPspsData] = await Promise.all([
                            apiClient.analytics.getStoreAnalytics(storeId, 'month'),
                            apiClient.storePsp.getByStore(storeId)
                          ])
                          setStoreData(analytics)
                          setConfiguredPsps(configuredPspsData)
                          updateLocalStatesFromAnalytics(analytics) // Mettre à jour les états locaux
                          
                          setIsConfigDialogOpen(false)
                          toast.success('Configuration de routing sauvegardée')
                        } catch (err) {
                          console.error('Failed to save routing config:', err)
                          toast.error('Erreur lors de la sauvegarde')
                        } finally {
                          setIsSavingRouting(false)
                        }
                      }}
                      disabled={routingMode === "manual" && totalWeight !== 100 || isSavingRouting}
                    >
                      {isSavingRouting ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode de routing simplifié */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">
                  {routingMode === "automatic" ? "Routing Automatique" : "Routing Manuel"}
                </span>
              </div>
              <Badge variant="outline" className="bg-green-500/20 text-green-400">
                Actif
                </Badge>
              </div>

            {routingMode === "automatic" ? (
              <div className="text-sm text-muted-foreground">
                Optimisation automatique basée sur les performances en temps réel
              </div>
            ) : (
              /* Répartition simple pour le mode manuel */
              <div className="space-y-3">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                  {activePsps.map((psp, index) => {
                    const weight = weights[psp.id] || 0
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500']
                    return (
                      <div
                        key={psp.id}
                        className={`h-full ${colors[index % colors.length]}`}
                        style={{ width: `${weight}%` }}
                      />
                    )
                  })}
                </div>
                
                <div className="flex flex-wrap gap-3 text-sm">
                  {activePsps.map((psp, index) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500']
                    return (
                      <div key={psp.id} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${colors[index % colors.length]}`}></div>
                        <span>{psp.name} ({weights[psp.id] || 0}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Fallback */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Configuration Fallback
              </CardTitle>
              <Dialog open={isFallbackConfigOpen} onOpenChange={setIsFallbackConfigOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-primary/20 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configuration de la Séquence Fallback</DialogTitle>
                  </DialogHeader>
                  
                  <div className="py-4 space-y-6">
                    {/* Activation globale */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                      <div>
                        <div className="font-medium">Fallback activé</div>
                        <div className="text-sm text-muted-foreground">
                          Active automatiquement les PSP de secours en cas d&apos;échec
                        </div>
                      </div>
                      <Checkbox
                        checked={fallbackConfig.enabled}
                        onCheckedChange={(checked) => setFallbackConfig(prev => ({ ...prev, enabled: !!checked }))}
                      />
                    </div>

                    {/* Configuration des tentatives */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Paramètres de tentatives</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nombre max de tentatives</label>
                          <select 
                            value={fallbackConfig.maxRetries}
                            onChange={(e) => setFallbackConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                          >
                            <option value={1}>1 tentative</option>
                            <option value={2}>2 tentatives</option>
                            <option value={3}>3 tentatives</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Ordre des PSP */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Ordre des PSP Fallback</h4>
                        
                        {/* Input pour ajouter un PSP */}
                        <div className="relative">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Ajouter un PSP..."
                              value={pspSearchInput}
                              onChange={(e) => {
                                setPspSearchInput(e.target.value)
                                setShowPspSuggestions(e.target.value.length > 0)
                              }}
                              onFocus={() => setShowPspSuggestions(pspSearchInput.length > 0)}
                              className="w-48 text-sm"
                            />
                            <Button size="sm" variant="outline">
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Suggestions dropdown */}
                          {showPspSuggestions && (
                            <div className="absolute top-full left-0 right-0 z-[60] mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {availablePsps
                                .filter(psp => 
                                  psp.name.toLowerCase().includes(pspSearchInput.toLowerCase())
                                )
                                .map(psp => (
                                <div
                                  key={psp.id}
                                  className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer text-foreground"
                                  onClick={() => {
                                    const newOrder = fallbackConfig.psps.length > 0 
                                      ? Math.max(...fallbackConfig.psps.map(p => p.order)) + 1 
                                      : 1
                                    setFallbackConfig(prev => ({
                                      ...prev,
                                      psps: [...prev.psps, {
                                        id: psp.id,
                                        name: psp.name,
                                        order: newOrder
                                      }]
                                    }))
                                    setPspSearchInput("")
                                    setShowPspSuggestions(false)
                                  }}
                                >
                                  <Image
                                    src={psp.logo}
                                    alt={psp.name}
                                    width={20}
                                    height={20}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{psp.name}</span>
                                </div>
                              ))}
                              {availablePsps.filter(psp => 
                                psp.name.toLowerCase().includes(pspSearchInput.toLowerCase())
                              ).length === 0 && (
                                <div className="p-2 text-sm text-muted-foreground">
                                  Aucun PSP disponible
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {fallbackConfig.psps
                          .sort((a, b) => a.order - b.order)
                          .map((psp, index) => (
                          <div key={psp.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-semibold text-orange-400">
                                {psp.order}
                              </div>
                              <div>
                                <div className="font-medium">{psp.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Fallback #{psp.order}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {/* Boutons ordre */}
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  disabled={index === 0}
                                  onClick={() => {
                                    const newPsps = [...fallbackConfig.psps]
                                    const currentIndex = newPsps.findIndex(p => p.id === psp.id)
                                    if (currentIndex > 0) {
                                      [newPsps[currentIndex - 1].order, newPsps[currentIndex].order] = 
                                      [newPsps[currentIndex].order, newPsps[currentIndex - 1].order]
                                      setFallbackConfig(prev => ({ ...prev, psps: newPsps }))
                                    }
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  ↑
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  disabled={index === fallbackConfig.psps.length - 1}
                                  onClick={() => {
                                    const newPsps = [...fallbackConfig.psps]
                                    const currentIndex = newPsps.findIndex(p => p.id === psp.id)
                                    if (currentIndex < newPsps.length - 1) {
                                      [newPsps[currentIndex + 1].order, newPsps[currentIndex].order] = 
                                      [newPsps[currentIndex].order, newPsps[currentIndex + 1].order]
                                      setFallbackConfig(prev => ({ ...prev, psps: newPsps }))
                                    }
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  ↓
                                </Button>
            </div>

                              {/* Bouton supprimer */}
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  const newPsps = fallbackConfig.psps.filter(p => p.id !== psp.id)
                                  // Réorganiser les ordres après suppression
                                  const reorderedPsps = newPsps.map((p, idx) => ({ ...p, order: idx + 1 }))
                                  // Désactiver automatiquement le fallback si plus aucun PSP
                                  const shouldDisableFallback = reorderedPsps.length === 0
                                  setFallbackConfig(prev => ({ 
                                    ...prev, 
                                    psps: reorderedPsps,
                                    enabled: shouldDisableFallback ? false : prev.enabled
                                  }))
                                }}
                                className="h-8 w-8 p-0 hover:bg-red-500/20 hover:border-red-500/50"
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsFallbackConfigOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={async () => {
                      try {
                        setIsSavingFallback(true)
                        const configData = {
                          mode: routingMode.toUpperCase() as 'AUTOMATIC' | 'MANUAL',
                          fallbackEnabled: fallbackConfig.enabled,
                          maxRetries: fallbackConfig.maxRetries,
                          fallbackSequence: fallbackConfig.psps.map(psp => ({ pspId: psp.id, order: psp.order })),
                        }
                        
                        await apiClient.routing.updateConfig(storeId, configData)
                        
                        // Recharger les données
                        const [analytics, configuredPspsData] = await Promise.all([
                          apiClient.analytics.getStoreAnalytics(storeId, 'month'),
                          apiClient.storePsp.getByStore(storeId)
                        ])
                        setStoreData(analytics)
                        setConfiguredPsps(configuredPspsData)
                        updateLocalStatesFromAnalytics(analytics) // Mettre à jour les états locaux
                        
                        setIsFallbackConfigOpen(false)
                        toast.success('Configuration de fallback sauvegardée')
                      } catch (err) {
                        console.error('Failed to save fallback config:', err)
                        toast.error('Erreur lors de la sauvegarde')
                      } finally {
                        setIsSavingFallback(false)
                      }
                    }}
                    disabled={isSavingFallback}>
                      {isSavingFallback ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fallback simplifié */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${fallbackConfig.enabled ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                <span className="font-medium">
                  {fallbackConfig.enabled ? "Fallback Activé" : "Fallback Désactivé"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-500/20 text-orange-400">
                  {fallbackConfig.maxRetries} tentative{fallbackConfig.maxRetries > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {fallbackConfig.enabled ? (
              <div className="flex items-center gap-2 text-sm">
                {fallbackConfig.psps
                  .sort((a, b) => a.order - b.order)
                  .map((psp, index) => (
                  <div key={psp.id} className="flex items-center gap-1">
                    <span className="font-medium">{psp.name}</span>
                    {index < fallbackConfig.psps.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Les transactions échouées ne seront pas reprises automatiquement
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visualisation du Flow */}
      <PaymentFlowVisualization
        storeId={storeId}
        activePsps={activePsps}
        routingMode={routingMode}
        weights={weights}
        fallbackConfig={fallbackConfig}
      />

    </div>
  )
}
