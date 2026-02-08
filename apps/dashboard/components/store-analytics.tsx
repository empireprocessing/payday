"use client"

import { useState, useEffect } from "react"
import { apiClient, useApiError, formatCurrency } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft, Users, CreditCard, DollarSign, Target,
  Activity, TrendingDown, Zap, CheckCircle2, XCircle
} from "lucide-react"
import Link from "next/link"
import type { StoreAnalytics } from "@/lib/types"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar,
  PieChart, Pie, Cell, Label
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from "@/components/ui/chart"

interface ConversionFunnel {
  store: { id: string; name: string; domain: string };
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

const periodToDays = (period: 'day' | 'week' | 'month'): number => {
  switch (period) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
  }
}

const periodLabel = (period: 'day' | 'week' | 'month') =>
  period === 'day' ? '24h' : period === 'week' ? '7 jours' : '30 jours'

const PSP_DONUT_COLORS = [
  "#635BFF", "#0ABF53", "#0066CC", "#00457C", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
]

const revenueChartConfig = {
  revenue: { label: "Revenus", color: "#635BFF" },
} satisfies ChartConfig

const checkoutsChartConfig = {
  checkoutsInitiated: { label: "Checkouts", color: "#3b82f6" },
  paymentSuccessful: { label: "Paiements", color: "#0ABF53" },
} satisfies ChartConfig

export function StoreAnalyticsComponent({ storeId }: StoreAnalyticsComponentProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
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
        setError(handleError(err))
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAnalytics()
  }, [storeId, period, days])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon" className="glassmorphism rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glassmorphism">
              <CardContent className="pt-6">
                <div className="h-8 w-16 bg-muted/30 rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-muted/30 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="glassmorphism">
          <CardContent className="pt-6">
            <div className="h-[280px] bg-muted/20 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !conversionFunnel || !storeAnalytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon" className="glassmorphism rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <Card className="glassmorphism">
          <CardContent className="pt-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive font-medium">{error || "Aucune donnée disponible"}</p>
              <Button onClick={() => window.location.reload()} className="mt-4" variant="outline" size="sm">
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRevenue = storeAnalytics.psps.reduce((sum, psp) => sum + psp.totalRevenue, 0)
  const successfulPayments = storeAnalytics.psps.reduce((sum, psp) => sum + psp.successfulPayments, 0)
  const overallConversionRate = conversionFunnel.funnel.checkoutsInitiated > 0
    ? (successfulPayments / conversionFunnel.funnel.checkoutsInitiated) * 100
    : 0
  const globalAR = approvalRate ? approvalRate.global.approvalRate : 0

  // Funnel simplifié : 4 étapes clés
  const funnelSimple = [
    { label: "Checkouts", value: conversionFunnel.funnel.checkoutsInitiated, color: "#3b82f6" },
    { label: "Infos saisies", value: conversionFunnel.funnel.customerInfoEntered, color: "#8b5cf6" },
    { label: "Paiement tenté", value: conversionFunnel.funnel.paymentAttempted, color: "#f59e0b" },
    { label: "Paiement réussi", value: conversionFunnel.funnel.paymentSuccessful, color: "#0ABF53" },
  ]
  const funnelMax = funnelSimple[0].value || 1

  // PSP donut data
  const pspDonutData = storeAnalytics.psps
    .filter(psp => psp.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((psp, i) => ({
      name: psp.name,
      value: psp.totalRevenue,
      totalPayments: psp.totalPayments,
      successfulPayments: psp.successfulPayments,
      ar: psp.totalPayments > 0 ? (psp.successfulPayments / psp.totalPayments * 100) : 0,
      color: PSP_DONUT_COLORS[i % PSP_DONUT_COLORS.length],
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/boutiques">
            <Button variant="ghost" size="icon" className="glassmorphism rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold gradient-text">{conversionFunnel.store.name}</h1>
            <p className="text-muted-foreground text-sm">{conversionFunnel.store.domain}</p>
          </div>
        </div>
        <Select value={period} onValueChange={(v: 'day' | 'week' | 'month') => setPeriod(v)}>
          <SelectTrigger className="w-32 glassmorphism">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">24h</SelectItem>
            <SelectItem value="week">7 jours</SelectItem>
            <SelectItem value="month">30 jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/20 group-hover:scale-110 transition-transform">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm text-muted-foreground">Checkouts</span>
            </div>
            <div className="text-3xl font-bold">{conversionFunnel.funnel.checkoutsInitiated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel(period)}</p>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-500/20 group-hover:scale-110 transition-transform">
                <CreditCard className="h-4 w-4 text-green-400" />
              </div>
              <span className="text-sm text-muted-foreground">Paiements</span>
            </div>
            <div className="text-3xl font-bold">{successfulPayments.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs font-medium ${overallConversionRate >= 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                {overallConversionRate.toFixed(1)}% conversion
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-yellow-500/20 group-hover:scale-110 transition-transform">
                <DollarSign className="h-4 w-4 text-yellow-400" />
              </div>
              <span className="text-sm text-muted-foreground">Revenus</span>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(totalRevenue)}</div>
            {dailyRevenue && (
              <p className="text-xs text-muted-foreground mt-1">
                ~{formatCurrency(dailyRevenue.summary.averageDailyRevenue)}/jour
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle hover:scale-105 transition-all duration-300 group">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/20 group-hover:scale-110 transition-transform">
                <Target className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-sm text-muted-foreground">Approval Rate</span>
            </div>
            <div className={`text-3xl font-bold ${globalAR >= 70 ? 'text-green-400' : globalAR >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {globalAR.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {approvalRate ? `${approvalRate.global.successfulPayments}/${approvalRate.global.totalPayments}` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {dailyRevenue && dailyRevenue.data.length > 0 && (
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Revenus quotidiens</CardTitle>
            </div>
            {dailyRevenue.summary.bestDay.date && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Meilleur jour</div>
                <div className="text-sm font-semibold">{formatCurrency(dailyRevenue.summary.bestDay.revenue)}</div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ChartContainer config={revenueChartConfig} className="h-full w-full">
                <AreaChart data={dailyRevenue.data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <defs>
                    <linearGradient id="storeRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635BFF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg">
                            <p className="text-sm font-medium text-white">
                              {new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-lg font-bold text-primary mt-1">{formatCurrency(data.revenue)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.successfulPayments} paiement{data.successfulPayments > 1 ? 's' : ''}
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
                    stroke="#635BFF"
                    strokeWidth={2}
                    fill="url(#storeRevenueGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row: Funnel + PSP Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversion Funnel */}
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20">
                <TrendingDown className="h-4 w-4 text-blue-400" />
              </div>
              <CardTitle className="text-lg font-semibold">Funnel</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">{periodLabel(period)}</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelSimple.map((step, i) => {
                const widthPct = funnelMax > 0 ? (step.value / funnelMax) * 100 : 0
                const dropRate = i > 0 && funnelSimple[i - 1].value > 0
                  ? ((funnelSimple[i - 1].value - step.value) / funnelSimple[i - 1].value * 100)
                  : 0
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{step.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{step.value.toLocaleString()}</span>
                        {i > 0 && dropRate > 0 && (
                          <span className="text-xs text-red-400">-{dropRate.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${widthPct}%`, backgroundColor: step.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Taux de conversion final</span>
              <span className={`text-lg font-bold ${overallConversionRate >= 5 ? 'text-green-400' : overallConversionRate >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                {overallConversionRate.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PSP Breakdown */}
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20">
                <Zap className="h-4 w-4 text-purple-400" />
              </div>
              <CardTitle className="text-lg font-semibold">Répartition PSP</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {pspDonutData.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                Aucune donnée
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="shrink-0 w-[160px] h-[160px]">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={pspDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pspDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-white text-xs font-bold">
                                  {formatCurrency(totalRevenue)}
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          const pct = totalRevenue > 0 ? ((data.value / totalRevenue) * 100).toFixed(1) : '0'
                          return (
                            <div className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium text-white mb-1">{data.name}</p>
                              <div className="space-y-0.5 text-xs">
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Revenus</span>
                                  <span className="font-semibold text-white">{formatCurrency(data.value)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Part</span>
                                  <span className="font-semibold text-white">{pct}%</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">AR</span>
                                  <span className={`font-semibold ${data.ar >= 70 ? 'text-green-400' : data.ar >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {data.ar.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </PieChart>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {pspDonutData.map((psp, i) => {
                    const pct = totalRevenue > 0 ? ((psp.value / totalRevenue) * 100).toFixed(1) : '0'
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: psp.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white truncate">{psp.name}</span>
                            <span className="text-sm font-semibold text-white shrink-0 ml-2">{formatCurrency(psp.value)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                            <span className="text-xs text-muted-foreground">{psp.totalPayments} tx</span>
                            <span className={`text-xs font-medium ${psp.ar >= 70 ? 'text-green-400' : psp.ar >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              AR {psp.ar.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: Checkouts Chart + Approval Rate by PSP */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Checkouts Chart */}
        {dailyCheckouts && dailyCheckouts.data.length > 0 && (
          <Card className="glassmorphism glow-subtle">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                <CardTitle className="text-lg font-semibold">Checkouts</CardTitle>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{dailyCheckouts.summary.totalCheckouts.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">total</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ChartContainer config={checkoutsChartConfig} className="h-full w-full">
                  <BarChart data={dailyCheckouts.data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      className="text-xs"
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs"
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="glassmorphism border border-primary/20 rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium text-white">
                                {new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </p>
                              <div className="mt-1 space-y-0.5 text-xs">
                                <div className="flex justify-between gap-3">
                                  <span className="text-blue-400">Checkouts</span>
                                  <span className="font-semibold text-white">{data.checkoutsInitiated}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-green-400">Paiements</span>
                                  <span className="font-semibold text-white">{data.paymentSuccessful}</span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="checkoutsInitiated" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.3} />
                    <Bar dataKey="paymentSuccessful" fill="#0ABF53" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Rate by PSP */}
        {approvalRate && approvalRate.byPsp.length > 0 && (
          <Card className="glassmorphism glow-subtle">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20">
                  <Target className="h-4 w-4 text-green-400" />
                </div>
                <CardTitle className="text-lg font-semibold">AR par PSP</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approvalRate.byPsp
                  .sort((a, b) => b.totalPayments - a.totalPayments)
                  .map((psp) => {
                    const arColor = psp.approvalRate >= 70 ? 'text-green-400' : psp.approvalRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                    const barColor = psp.approvalRate >= 70 ? '#0ABF53' : psp.approvalRate >= 50 ? '#F59E0B' : '#EF4444'
                    return (
                      <div key={psp.pspId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{psp.pspName}</span>
                            <span className="text-xs text-muted-foreground">{psp.totalPayments} tx</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-green-400" />
                              {psp.successfulPayments}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <XCircle className="h-3 w-3 text-red-400" />
                              {psp.failedPayments}
                            </div>
                            <span className={`text-sm font-bold ${arColor}`}>
                              {psp.approvalRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${psp.approvalRate}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
