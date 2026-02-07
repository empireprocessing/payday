"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiClient, useApiError, formatCurrency } from "@/lib/api-client"
import type { OverviewMetrics, StoreMetric, PspMetric, TrendData, Store, PspWithUsage } from "@/lib/api-client"
import type { ApprovalRatesResponse } from "@/lib/actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    XAxis, YAxis, Area, AreaChart, CartesianGrid, BarChart, Bar
} from 'recharts'
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartConfig,
} from "@/components/ui/chart"
import {
    TrendingUp, TrendingDown, Store as StoreIcon,
    CreditCard,
    DollarSign, Activity,
    MoreHorizontal, Target,
    Zap, Gauge
} from "lucide-react"
import { StoreMultiSelect } from "@/components/store-multi-select"
import { PeriodSelector, type PeriodType, type PeriodRange } from "@/components/period-selector"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Types importés depuis api-client.ts

// Couleurs pour les PSP
const PSP_COLORS = {
  stripe: "#635BFF",
  paypal: "#00457C",
  checkout: "#0066CC",
  adyen: "#0ABF53",
  default: "#8B5CF6"
}

// Configuration du graphique
const chartConfig = {
  totalPayments: {
    label: "Paiements",
    color: "#2859FF",
  },
  successfulAmount: {
    label: "Revenus",
    color: "#2859FF",
  },
} satisfies ChartConfig

// Données remplacées par les appels API

export function AnalyticsDashboard() {
  const router = useRouter()
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null)
  const [storeMetrics, setStoreMetrics] = useState<StoreMetric[]>([])
  const [pspMetrics, setPspMetrics] = useState<PspMetric[]>([])
  const [pspsWithUsage, setPspsWithUsage] = useState<PspWithUsage[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [approvalRates, setApprovalRates] = useState<ApprovalRatesResponse | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("30d")
  const [customRange, setCustomRange] = useState<PeriodRange | undefined>(undefined)
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [currentDays, setCurrentDays] = useState<number>(30)
  const [currentFromDate, setCurrentFromDate] = useState<Date | undefined>(undefined)
  const [currentToDate, setCurrentToDate] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { handleError } = useApiError()

  // Charger la liste des stores (une seule fois)
  useEffect(() => {
    const loadStores = async () => {
      try {
        const storesList = await apiClient.stores.getAll()
        setStores(storesList)
      } catch (err) {
        console.error('Failed to load stores:', err)
      }
    }
    loadStores()
  }, [])

  // Charger les données analytics (avec filtres)
  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        // Si c'est le premier chargement, utiliser loading, sinon utiliser isRefreshing
        if (!overviewMetrics) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }
        setError(null)

        // Calculer la période et les jours selon le type sélectionné
        let period: 'day' | 'week' | 'month' = 'month'
        let days = 30
        
        if (selectedPeriod === 'custom' && customRange) {
          // Pour une période personnalisée, calculer le nombre de jours
          const diffTime = Math.abs(customRange.to.getTime() - customRange.from.getTime())
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          // Déterminer le type de période selon le nombre de jours
          if (days <= 1) {
            period = 'day'
          } else if (days <= 7) {
            period = 'week'
          } else {
            period = 'month'
          }
        } else {
          // Périodes rapides
          period = selectedPeriod === '7d' ? 'week' : selectedPeriod === '30d' ? 'month' : selectedPeriod === '90d' ? 'month' : 'day'
          days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : selectedPeriod === '24h' ? 1 : 30
        }
        
        // Construire les paramètres de requête
        const storeIdsParam = selectedStoreIds.length > 0 ? selectedStoreIds.join(',') : undefined
        // Toujours passer days pour garantir la cohérence entre getOverview et getTrendData
        const daysParam = days
        
        // Pour les périodes personnalisées, passer les dates exactes au graphique
        const fromDate = (selectedPeriod === 'custom' && customRange) ? customRange.from : undefined
        const toDate = (selectedPeriod === 'custom' && customRange) ? customRange.to : undefined
        
        // Sauvegarder les valeurs pour la clé du graphique
        setCurrentDays(days)
        setCurrentFromDate(fromDate)
        setCurrentToDate(toDate)
        
        // Charger toutes les données en parallèle
        const [overview, storesMetrics, psps, pspsUsage, trends, approvalRatesData] = await Promise.all([
          apiClient.analytics.getOverview(period, storeIdsParam, daysParam),
          apiClient.analytics.getStoreMetrics(period, storeIdsParam, daysParam),
          apiClient.analytics.getPspMetrics(period, storeIdsParam, daysParam),
          apiClient.analytics.getPspsWithUsage(storeIdsParam, period, daysParam),
          apiClient.analytics.getTrendData(period, days, storeIdsParam, fromDate, toDate),
          apiClient.analytics.getApprovalRates(storeIdsParam, daysParam, fromDate, toDate),
        ])

        setOverviewMetrics(overview)
        setStoreMetrics(storesMetrics)
        setPspMetrics(psps)
        setPspsWithUsage(pspsUsage)
        setApprovalRates(approvalRatesData)
        // Trier les données de tendance par date pour un affichage correct
        const sortedTrends = [...trends].sort((a, b) => a.date.localeCompare(b.date))
        setTrendData(sortedTrends)
        
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Une erreur est survenue')
        }
        console.error('Failed to load analytics data:', err)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    }

    loadAnalyticsData()
  }, [selectedPeriod, selectedStoreIds, customRange])


  // Fonction pour obtenir la couleur du PSP
  const getPspColor = (pspType: string) => {
    return PSP_COLORS[pspType as keyof typeof PSP_COLORS] || PSP_COLORS.default
  }

  // Affichage du loading
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 mt-10">
          <h1 className="text-5xl font-bold gradient-text max-w-2xl mx-auto leading-tight">
            Analytics Avancées
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Analysez vos boutiques et PSP avec des métriques détaillées
          </p>
        </div>

        {/* Métriques principales - Skeleton */}
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glassmorphism border-primary/20 animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted/30"></div>
                  <div className="h-4 w-16 bg-muted/30 rounded"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-10 w-20 bg-muted/30 rounded"></div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-muted/30 rounded-full"></div>
                    <div className="h-4 w-12 bg-muted/30 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Graphiques - Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glassmorphism animate-pulse">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted/30"></div>
                  <div className="h-5 w-40 bg-muted/30 rounded"></div>
                </div>
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 w-12 bg-muted/30 rounded"></div>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted/20 rounded"></div>
            </CardContent>
          </Card>

          <Card className="glassmorphism animate-pulse">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/30"></div>
                <div className="h-5 w-24 bg-muted/30 rounded"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 bg-muted/10 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-muted/30"></div>
                        <div>
                          <div className="h-4 w-16 bg-muted/30 rounded mb-1"></div>
                          <div className="h-3 w-20 bg-muted/30 rounded"></div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="h-3 w-16 bg-muted/30 rounded mb-1"></div>
                        <div className="h-4 w-12 bg-muted/30 rounded"></div>
                      </div>
                      <div>
                        <div className="h-3 w-12 bg-muted/30 rounded mb-1"></div>
                        <div className="h-4 w-16 bg-muted/30 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables - Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, tableIndex) => (
            <Card key={tableIndex} className="glassmorphism animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted/30"></div>
                  <div className="h-5 w-24 bg-muted/30 rounded"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(3)].map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center justify-between p-3 border border-muted/20 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-muted/30"></div>
                        <div>
                          <div className="h-4 w-24 bg-muted/30 rounded mb-1"></div>
                          <div className="h-3 w-16 bg-muted/30 rounded"></div>
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-muted/30 rounded"></div>
                    </div>
                  ))}
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
        <div className="text-center space-y-4 mt-10">
          <h1 className="text-5xl font-bold gradient-text max-w-2xl mx-auto leading-tight">
            Analytics Avancées
          </h1>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-2xl mx-auto">
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
      </div>
    )
  }

  // Vérifier que les données sont chargées
  if (!overviewMetrics) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="text-center space-y-4 mt-10">
          <h1 className="text-5xl font-bold gradient-text max-w-2xl mx-auto leading-tight">
            Analytics Avancées
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Analysez vos boutiques et PSP avec des métriques détaillées
          </p>
        </div>
      </div>

      {/* Filtres - Design subtil */}
      <div className="flex flex-wrap items-center gap-4 justify-end">
        {/* Filtre par stores */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Boutiques:</span>
          <StoreMultiSelect
            stores={stores}
            selectedStoreIds={selectedStoreIds}
            onSelectionChange={setSelectedStoreIds}
            placeholder="Toutes"
            className="w-[200px]"
          />
        </div>
        {/* Filtre par période */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Période:</span>
          <PeriodSelector
            value={selectedPeriod}
            customRange={customRange}
            onPeriodChange={setSelectedPeriod}
            onCustomRangeChange={setCustomRange}
          />
        </div>
      </div>

      {/* Daily Cap Total */}
      {(() => {
        // Les deux sont en CENTIMES (capacity = dailyCapacityEur, mal nommé)
        const totalCap = pspsWithUsage.reduce((sum, psp) => sum + (psp.capacity || 0), 0)
        const totalUsage = pspsWithUsage.reduce((sum, psp) => sum + psp.usageBusinessDay, 0)
        const usagePercent = totalCap > 0 ? Math.round(totalUsage / totalCap * 100) : 0

        if (totalCap === 0) return null

        return (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl glassmorphism border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20">
                <Gauge className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Cap Daily Total</div>
                <div className="text-xs text-muted-foreground">{pspsWithUsage.length} PSP actifs (depuis 6h)</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {formatCurrency(totalUsage)} <span className="text-muted-foreground font-normal">/</span> {formatCurrency(totalCap)}
                </div>
                <div className="text-xs text-muted-foreground">Utilisé depuis 6h Paris</div>
              </div>
              <div className="w-32">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Utilisation</span>
                  <span className={usagePercent >= 90 ? 'text-red-400' : usagePercent >= 70 ? 'text-orange-400' : 'text-green-400'}>
                    {usagePercent}%
                  </span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Métriques principales */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* Total Boutiques */}
        <Card className="glassmorphism border-primary/20 relative overflow-hidden group hover:scale-105 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 glow-primary group-hover:scale-110 transition-transform">
                <StoreIcon className="h-5 w-5 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-medium text-white">Boutiques</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3">
              <div className="text-4xl font-bold text-white">{overviewMetrics.totalStores}</div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  overviewMetrics.growth.stores >= 0 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {overviewMetrics.growth.stores >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{overviewMetrics.growth.stores >= 0 ? '+' : ''}{overviewMetrics.growth.stores}%</span>
                </div>
                <span className="text-muted-foreground">Ce mois</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total PSP */}
        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 group-hover:scale-110 transition-transform">
                <CreditCard className="h-5 w-5 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-medium">PSP Actifs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-4xl font-bold">{overviewMetrics.totalPsps}</div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  overviewMetrics.growth.psps >= 0 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {overviewMetrics.growth.psps >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{overviewMetrics.growth.psps >= 0 ? '+' : ''}{overviewMetrics.growth.psps}%</span>
                </div>
                <span className="text-muted-foreground">Ce mois</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paiements */}
        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 group-hover:scale-110 transition-transform">
                <Target className="h-5 w-5 text-green-400" />
              </div>
              <CardTitle className="text-sm font-medium">Paiements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-4xl font-bold">{overviewMetrics.successfulPayments}</div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  overviewMetrics.growth.payments >= 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {overviewMetrics.growth.payments >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{overviewMetrics.growth.payments >= 0 ? '+' : ''}{overviewMetrics.growth.payments}%</span>
                </div>
                <span className="text-muted-foreground">Ce mois</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenus Total */}
        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 group-hover:scale-110 transition-transform">
                <DollarSign className="h-5 w-5 text-yellow-400" />
              </div>
              <CardTitle className="text-sm font-medium">Revenus Total</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-4xl font-bold">{formatCurrency(overviewMetrics.totalRevenue)}</div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  overviewMetrics.growth.revenue >= 0 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {overviewMetrics.growth.revenue >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{overviewMetrics.growth.revenue >= 0 ? '+' : ''}{overviewMetrics.growth.revenue}%</span>
                </div>
                <span className="text-muted-foreground">Ce mois</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques principaux */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tendances des Paiements - Prend toute la largeur */}
        <Card className="glassmorphism glow-subtle hover:glow-primary transition-all duration-300 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Tendances des Paiements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {isRefreshing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  Mise à jour...
                </div>
              </div>
            )}
            <div className="w-full h-[350px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart
                accessibilityLayer
                data={trendData}
                key={`trend-${selectedStoreIds.join(',')}-${selectedPeriod}-${currentDays}-${currentFromDate?.getTime()}-${currentToDate?.getTime()}`}
                margin={{
                  top: 20,
                  right: 20,
                  left: 8,
                  bottom: 32,
                }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(255, 255, 255, 0.05)" 
                  vertical={false}
                  horizontal={true}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(value) => {
                    try {
                      const date = new Date(value);
                      if (isNaN(date.getTime())) return '';
                      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    } catch {
                      return '';
                    }
                  }}
                  interval="preserveStartEnd"
                  minTickGap={60}
                  angle={0}
                  textAnchor="middle"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={60}
                  tickFormatter={(value) => {
                    if (value === 0) return '0€';
                    // value est déjà en centimes, formatCurrency divise déjà par 100
                    return formatCurrency(value);
                  }}
                />
                <ChartTooltip 
                  cursor={{ stroke: '#2859FF', strokeWidth: 1, strokeDasharray: '5 5' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const date = new Date(data.date);
                      return (
                        <div className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg">
                          <p className="text-sm font-medium text-white mb-2">
                            {date.toLocaleDateString('fr-FR', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-muted-foreground">Paiements réussis</span>
                              <span className="text-sm font-semibold text-white">{data.successfulPayments}</span>
                            </div>
                            {data.successfulAmount > 0 && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-muted-foreground">Revenus</span>
                                <span className="text-sm font-semibold text-white">{formatCurrency(data.successfulAmount)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <defs>
                  <linearGradient id="fillTotalPayments" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#2859FF"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="#2859FF"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="successfulAmount"
                  type="monotone"
                  fill="url(#fillTotalPayments)"
                  fillOpacity={1}
                  stroke="#2859FF"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ 
                    r: 5, 
                    fill: '#2859FF', 
                    strokeWidth: 2, 
                    stroke: '#fff',
                    style: { filter: 'drop-shadow(0 2px 4px rgba(40, 89, 255, 0.3))' }
                  }}
                />
              </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques Approval Rates */}
      {approvalRates && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Approval Rates */}
          <Card className="glassmorphism glow-subtle hover:glow-primary transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold">Approval Rates</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{approvalRates.globalApprovalRate.toFixed(1)}%</span>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {isRefreshing && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    Mise à jour...
                  </div>
                </div>
              )}
              <div className="w-full h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart
                    data={approvalRates.approvalRates}
                    key={`approval-${selectedStoreIds.join(',')}-${selectedPeriod}-${currentDays}-${currentFromDate?.getTime()}-${currentToDate?.getTime()}`}
                    margin={{
                      top: 20,
                      right: 20,
                      left: 8,
                      bottom: 32,
                    }}
                  >
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="rgba(255, 255, 255, 0.05)" 
                      vertical={false}
                      horizontal={true}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(value) => {
                        try {
                          const date = new Date(value);
                          if (isNaN(date.getTime())) return '';
                          return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                        } catch {
                          return '';
                        }
                      }}
                      interval="preserveStartEnd"
                      minTickGap={60}
                      angle={0}
                      textAnchor="middle"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      width={50}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                      domain={[0, 'dataMax']}
                    />
                    <ChartTooltip 
                      cursor={{ fill: 'rgba(40, 89, 255, 0.1)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const date = new Date(data.date);
                          return (
                            <div className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium text-white mb-2">
                                {date.toLocaleDateString('fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Taux d'approbation</span>
                                  <span className="text-sm font-semibold text-white">{data.approvalRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Paiements réussis</span>
                                  <span className="text-sm font-semibold text-white">{data.successfulPayments}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Total paiements</span>
                                  <span className="text-sm font-semibold text-white">{data.totalPayments}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="approvalRate"
                      fill="#0ABF53"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Tables détaillées */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance par Boutique */}
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <StoreIcon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Boutiques</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/10">
                    <TableHead className="text-foreground font-semibold">Boutique</TableHead>
                    <TableHead className="text-foreground font-semibold">Revenus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeMetrics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Aucune boutique disponible
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TooltipProvider>
                      {storeMetrics.map((store) => (
                        <Tooltip key={store.id}>
                          <TooltipTrigger asChild>
                            <TableRow 
                              className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                              onClick={() => router.push(`/boutiques/${store.id}/analytics`)}
                            >
                              <TableCell>
                                <div>
                                  <div className="font-medium">{store.name}</div>
                                  <div className="text-xs text-muted-foreground">{store.domain}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold">{formatCurrency(store.totalRevenue)}</div>
                              </TableCell>
                            </TableRow>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="right" 
                            className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg max-w-xs bg-background/95 backdrop-blur-sm"
                            sideOffset={8}
                          >
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-white mb-2">
                                {store.name}
                              </p>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Commandes</span>
                                  <span className="text-sm font-semibold text-white">{store.totalOrders}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">PSPs</span>
                                  <span className="text-sm font-semibold text-white">{store.pspCount}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Plateforme</span>
                                  <div className="flex items-center gap-2">
                                    {store.platform === 'SHOPIFY' ? (
                                      <>
                                        <img src="/shopify.svg" alt="Shopify" className="w-4 h-4 object-contain" />
                                        <span className="text-sm font-semibold text-white">Shopify</span>
                                      </>
                                    ) : store.platform === 'WOOCOMMERCE' ? (
                                      <>
                                        <img src="/woocommerce.svg" alt="WooCommerce" className="w-4 h-4 object-contain" />
                                        <span className="text-sm font-semibold text-white">WooCommerce</span>
                                      </>
                                    ) : (
                                      <span className="text-sm font-semibold text-white">{store.platform}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* PSP avec Usage et Capacité */}
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">PSP</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/10">
                    <TableHead className="text-foreground font-semibold">PSP</TableHead>
                    <TableHead className="text-foreground font-semibold">Paiements</TableHead>
                    <TableHead className="text-foreground font-semibold">Revenus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pspsWithUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Aucun PSP disponible
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TooltipProvider>
                      {pspsWithUsage.map((psp) => {
                        // Calculer le pourcentage d'utilisation (en euros pour le calcul)
                        const usageEur = psp.usageBusinessDay / 100;
                        const capacityEur = psp.capacity ? psp.capacity / 100 : null;
                        const usagePercent = capacityEur ? (usageEur / capacityEur) * 100 : null;
                        // Ne pas diviser ici, formatCurrency divise déjà par 100
                        
                        return (
                          <Tooltip key={psp.id}>
                            <TooltipTrigger asChild>
                              <TableRow 
                                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                                onClick={() => router.push(`/analytics/psp/${psp.id}`)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {psp.pspType === 'stripe' && (
                                      <img src="/stripe.png" alt="Stripe" className="w-6 h-6 object-contain" />
                                    )}
                                    {psp.pspType === 'checkout' && (
                                      <img src="/checkout-com.jpg" alt="Checkout.com" className="w-6 h-6 object-contain rounded-full" />
                                    )}
                                    {psp.pspType === 'paypal' && (
                                      <img src="/paypal.png" alt="PayPal" className="w-6 h-6 object-contain" />
                                    )}
                                    <span className="font-medium capitalize">{psp.pspType}</span>
                                    <span className="text-xs text-muted-foreground">({psp.name})</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium">{psp.totalPayments}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-semibold">{formatCurrency(psp.totalRevenue)}</div>
                                </TableCell>
                              </TableRow>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="right" 
                              className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg max-w-xs bg-background/95 backdrop-blur-sm"
                              sideOffset={8}
                            >
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-white mb-2">
                                  Usage jour / Capacité
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs text-muted-foreground">Usage (depuis 6h)</span>
                                    <span className="text-sm font-semibold text-white">{formatCurrency(psp.usageBusinessDay)}</span>
                                  </div>
                                  {psp.capacity !== null && (
                                    <>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs text-muted-foreground">Capacité</span>
                                        <span className="text-sm font-semibold text-white">{formatCurrency(psp.capacity)}</span>
                                      </div>
                                      {usagePercent !== null && (
                                        <>
                                          <div className="flex items-center justify-between gap-4">
                                            <span className="text-xs text-muted-foreground">Utilisation</span>
                                            <span className={`text-sm font-semibold ${
                                              usagePercent >= 90 ? 'text-red-400' :
                                              usagePercent >= 70 ? 'text-yellow-400' :
                                              'text-green-400'
                                            }`}>
                                              {usagePercent.toFixed(1)}%
                                            </span>
                                          </div>
                                          <div className="w-full bg-muted/20 rounded-full h-2 mt-2">
                                            <div
                                              className={`h-2 rounded-full transition-all ${
                                                usagePercent >= 90 ? 'bg-red-500' :
                                                usagePercent >= 70 ? 'bg-yellow-500' :
                                                'bg-green-500'
                                              }`}
                                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                            />
                                          </div>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {psp.capacity === null && (
                                    <div className="text-xs text-muted-foreground">Aucune capacité définie</div>
                                  )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
