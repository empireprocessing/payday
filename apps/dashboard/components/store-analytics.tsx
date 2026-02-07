"use client"

import { useState, useEffect } from "react"
import { apiClient, useApiError } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Target, BarChart3, Activity } from "lucide-react"
import Link from "next/link"
import type { StoreAnalytics } from "@/lib/types"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface ConversionFunnel {
  store: {
    id: string;
    name: string;
    domain: string;
  };
  funnel: {
    checkoutsInitiated: number;
    customerInfoProgress: number;
    customerInfoEntered: number;
    paymentInfoStarted: number;
    paymentInfoCompleted: number;
    payButtonClicked: number;
    paymentAttempted: number;
    paymentSuccessful: number;
  };
  conversionRates: {
    customerInfoRate: number;
    paymentStartRate: number;
    paymentCompleteRate: number;
    payButtonRate: number;
    paymentAttemptRate: number;
    finalConversionRate: number;
  };
}

interface StoreAnalyticsComponentProps {
  storeId: string;
}

// Mapper period vers nombre de jours
const periodToDays = (period: 'day' | 'week' | 'month'): number => {
  switch (period) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
  }
}

export function StoreAnalyticsComponent({ storeId }: StoreAnalyticsComponentProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  // Synchroniser days avec period
  const days = periodToDays(period)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel | null>(null)
  const [storeAnalytics, setStoreAnalytics] = useState<StoreAnalytics | null>(null)
  const [dailyRevenue, setDailyRevenue] = useState<{
    data: Array<{ date: string; revenue: number; successfulPayments: number; totalPayments: number }>;
    summary: { totalRevenue: number; averageDailyRevenue: number; bestDay: { date: string; revenue: number }; worstDay: { date: string; revenue: number } };
  } | null>(null)
  const [approvalRate, setApprovalRate] = useState<{
    global: { totalPayments: number; successfulPayments: number; failedPayments: number; approvalRate: number };
    byPsp: Array<{ pspId: string; pspName: string; totalPayments: number; successfulPayments: number; failedPayments: number; approvalRate: number }>;
  } | null>(null)
  const [dailyCheckouts, setDailyCheckouts] = useState<{
    data: Array<{ date: string; checkoutsInitiated: number; customerInfoEntered: number; paymentSuccessful: number }>;
    summary: { totalCheckouts: number; averageDailyCheckouts: number; bestDay: { date: string; checkouts: number }; worstDay: { date: string; checkouts: number } };
  } | null>(null)

  const { handleError } = useApiError()

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!storeId) return
      
      try {
        setLoading(true)
        setError(null)
        
        const [funnelData, analyticsData, revenueData, approvalData, checkoutsData] = await Promise.all([
          apiClient.analytics.getStoreConversionFunnel(storeId, period),
          apiClient.analytics.getStoreAnalytics(storeId, period),
          apiClient.analytics.getStoreDailyRevenue(storeId, days),
          apiClient.analytics.getStoreApprovalRate(storeId, period),
          apiClient.analytics.getStoreDailyCheckouts(storeId, days)
        ])

        setConversionFunnel(funnelData)
        setStoreAnalytics(analyticsData)
        setDailyRevenue(revenueData)
        setApprovalRate(approvalData)
        setDailyCheckouts(checkoutsData)
      } catch (err) {
        const errorMessage = handleError(err)
        setError(errorMessage)
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, period, days])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-8 w-48 bg-muted/30 rounded animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-muted/30 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted/30 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-20 bg-muted/30 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive font-medium">Erreur de chargement</p>
              <p className="text-muted-foreground mt-2">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4"
                variant="outline"
                size="sm"
              >
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!conversionFunnel || !storeAnalytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Aucune donnée disponible</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const funnelSteps = [
    { key: 'checkoutsInitiated', label: 'Checkouts initiés', value: conversionFunnel.funnel.checkoutsInitiated },
    { key: 'customerInfoProgress', label: 'Infos client commencées', value: conversionFunnel.funnel.customerInfoProgress || 0, rate: conversionFunnel.funnel.checkoutsInitiated > 0 ? ((conversionFunnel.funnel.customerInfoProgress || 0) / conversionFunnel.funnel.checkoutsInitiated) * 100 : 0 },
    { key: 'customerInfoEntered', label: 'Infos client saisies', value: conversionFunnel.funnel.customerInfoEntered, rate: conversionFunnel.conversionRates.customerInfoRate },
    { key: 'paymentInfoStarted', label: 'Paiement commencé', value: conversionFunnel.funnel.paymentInfoStarted, rate: conversionFunnel.conversionRates.paymentStartRate },
    { key: 'paymentInfoCompleted', label: 'Paiement complété', value: conversionFunnel.funnel.paymentInfoCompleted, rate: conversionFunnel.conversionRates.paymentCompleteRate },
    { key: 'payButtonClicked', label: 'Bouton payé cliqué', value: conversionFunnel.funnel.payButtonClicked, rate: conversionFunnel.conversionRates.payButtonRate },
    { key: 'paymentAttempted', label: 'Paiement tenté', value: conversionFunnel.funnel.paymentAttempted, rate: conversionFunnel.conversionRates.paymentAttemptRate },
    { key: 'paymentSuccessful', label: 'Paiement réussi', value: conversionFunnel.funnel.paymentSuccessful, rate: conversionFunnel.conversionRates.finalConversionRate },
  ]

  const totalRevenue = storeAnalytics.psps.reduce((sum, psp) => sum + psp.totalRevenue, 0)
  const successfulPayments = storeAnalytics.psps.reduce((sum, psp) => sum + psp.successfulPayments, 0)
  // Taux de conversion global : checkouts initiés / paiements réussis
  const overallConversionRate = conversionFunnel.funnel.checkoutsInitiated > 0 
    ? (successfulPayments / conversionFunnel.funnel.checkoutsInitiated) * 100 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Analytics - {conversionFunnel.store.name}</h1>
            <p className="text-muted-foreground">{conversionFunnel.store.domain}</p>
          </div>
        </div>
        
        <Select value={period} onValueChange={(value: 'day' | 'week' | 'month') => setPeriod(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">24h</SelectItem>
            <SelectItem value="week">7 jours</SelectItem>
            <SelectItem value="month">30 jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkouts initiés</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionFunnel.funnel.checkoutsInitiated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total sur {period === 'day' ? '24h' : period === 'week' ? '7 jours' : '30 jours'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paiements réussis</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulPayments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {overallConversionRate.toFixed(1)}% de taux de conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalRevenue / 100).toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground">
              {successfulPayments.toLocaleString()} paiements validés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PSP actifs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storeAnalytics.store.activePsps}</div>
            <p className="text-xs text-muted-foreground">
              Configurés pour cette boutique
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique des revenus quotidiens */}
      {dailyRevenue && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Revenus quotidiens
              <span className="text-sm font-normal text-muted-foreground">
                ({period === 'day' ? '24h' : period === 'week' ? '7 jours' : '30 jours'})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{dailyRevenue.summary.totalRevenue.toFixed(2)} €</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Moyenne/jour</p>
                <p className="text-2xl font-bold">{dailyRevenue.summary.averageDailyRevenue.toFixed(2)} €</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meilleur jour</p>
                <p className="text-xl font-bold">{dailyRevenue.summary.bestDay.revenue.toFixed(2)} €</p>
                <p className="text-xs text-muted-foreground">{new Date(dailyRevenue.summary.bestDay.date).toLocaleDateString('fr-FR')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Jour le plus faible</p>
                <p className="text-xl font-bold">{dailyRevenue.summary.worstDay.revenue.toFixed(2)} €</p>
                <p className="text-xs text-muted-foreground">{new Date(dailyRevenue.summary.worstDay.date).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue.data}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(value) => `${value}€`}
                    className="text-xs"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p className="text-lg font-bold text-primary mt-1">{data.revenue.toFixed(2)} €</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {data.successfulPayments} paiement{data.successfulPayments > 1 ? 's' : ''} réussi{data.successfulPayments > 1 ? 's' : ''}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fill="url(#revenueGradient)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphique des checkouts quotidiens */}
      {dailyCheckouts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Checkouts quotidiens
              <span className="text-sm font-normal text-muted-foreground">
                ({period === 'day' ? '24h' : period === 'week' ? '7 jours' : '30 jours'})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{dailyCheckouts.summary.totalCheckouts.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Moyenne/jour</p>
                <p className="text-2xl font-bold">{dailyCheckouts.summary.averageDailyCheckouts.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meilleur jour</p>
                <p className="text-xl font-bold">{dailyCheckouts.summary.bestDay.checkouts.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{dailyCheckouts.summary.bestDay.date ? new Date(dailyCheckouts.summary.bestDay.date).toLocaleDateString('fr-FR') : '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Jour le plus faible</p>
                <p className="text-xl font-bold">{dailyCheckouts.summary.worstDay.checkouts.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{dailyCheckouts.summary.worstDay.date ? new Date(dailyCheckouts.summary.worstDay.date).toLocaleDateString('fr-FR') : '-'}</p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyCheckouts.data}>
                  <defs>
                    <linearGradient id="checkoutsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p className="text-lg font-bold text-blue-500 mt-1">{data.checkoutsInitiated} checkouts</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {data.customerInfoEntered} infos client • {data.paymentSuccessful} paiement{data.paymentSuccessful > 1 ? 's' : ''} réussi{data.paymentSuccessful > 1 ? 's' : ''}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="checkoutsInitiated"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#checkoutsGradient)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Rate */}
      {approvalRate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Taux d&apos;approbation (Approval Rate)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pourcentage de paiements réussis sur le total des paiements tentés
            </p>
          </CardHeader>
          <CardContent>
            {/* Global Approval Rate */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Global</h3>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    {approvalRate.global.approvalRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {approvalRate.global.successfulPayments} / {approvalRate.global.totalPayments} paiements
                  </p>
                </div>
              </div>
              <Progress value={approvalRate.global.approvalRate} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>Réussis: {approvalRate.global.successfulPayments}</span>
                <span>Échoués: {approvalRate.global.failedPayments}</span>
              </div>
            </div>

            {/* Par PSP */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Par processeur de paiement</h3>
              {approvalRate.byPsp.map((psp) => (
                <div key={psp.pspId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{psp.pspName}</div>
                      <span className="text-xs text-muted-foreground">
                        ({psp.totalPayments} paiement{psp.totalPayments > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        psp.approvalRate >= 85 ? 'text-green-600' :
                        psp.approvalRate >= 70 ? 'text-green-500' :
                        psp.approvalRate >= 60 ? 'text-orange-500' :
                        psp.approvalRate >= 50 ? 'text-orange-400' :
                        'text-red-600'
                      }`}>
                        {psp.approvalRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={psp.approvalRate}
                    className={`h-2 ${
                      psp.approvalRate >= 85 ? '[&>div]:bg-green-600' :
                      psp.approvalRate >= 70 ? '[&>div]:bg-green-500' :
                      psp.approvalRate >= 60 ? '[&>div]:bg-orange-500' :
                      psp.approvalRate >= 50 ? '[&>div]:bg-orange-400' :
                      '[&>div]:bg-red-600'
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Réussis: {psp.successfulPayments}</span>
                    <span>Échoués: {psp.failedPayments}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel de conversion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Funnel de conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funnelSteps.map((step, index) => (
              <div key={step.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono">{step.value.toLocaleString()}</span>
                    {step.rate !== undefined && (
                      <div className="flex items-center gap-1">
                        {step.rate > 50 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-xs text-muted-foreground">{step.rate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                {step.rate !== undefined && (
                  <Progress value={step.rate} className="h-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance des PSP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance des PSP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storeAnalytics.psps.map((psp) => (
              <div key={psp.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{psp.name}</div>
                    <div className="text-sm text-muted-foreground">{psp.pspType}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-medium">{psp.totalPayments.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Paiements</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium">{(psp.totalRevenue / 100).toFixed(2)} €</div>
                    <div className="text-sm text-muted-foreground">Revenus</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium">{psp.totalPayments > 0 ? (psp.successfulPayments / psp.totalPayments * 100).toFixed(1) : '0.0'}%</div>
                    <div className="text-sm text-muted-foreground">Conversion</div>
                  </div>
                  
                  {psp.avgProcessingTime && (
                    <div className="text-right">
                      <div className="font-medium">{(psp.avgProcessingTime / 1000).toFixed(1)}s</div>
                      <div className="text-sm text-muted-foreground">Temps moyen</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration du routage */}
      
    </div>
  )
}
