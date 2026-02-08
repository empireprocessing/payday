"use client"

import { useState, useEffect } from "react"
import { getPspDetails, getPspUsageTrend, getPspUpcomingFunds, type PspUsageTrendData, type PspUpcomingFundsResponse } from "@/lib/actions"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Zap,
  ShieldCheck,
  CreditCard,
  ArrowUpRight,
  Clock,
  Check,
} from "lucide-react"
import Link from "next/link"
import type { PspDetailsResponse } from "@/lib/actions"
import Image from "next/image"
import {
  XAxis, YAxis, Area, AreaChart, CartesianGrid, ReferenceLine
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from "@/components/ui/chart"
import { PeriodSelector, type PeriodType, type PeriodRange } from "@/components/period-selector"

interface PspAnalyticsComponentProps {
  pspId: string;
}

function StatCard({ label, value, subtitle, icon: Icon, trend, color = "primary" }: {
  label: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; label: string }
  color?: "primary" | "emerald" | "amber" | "red"
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-red-500/10 text-red-600",
  }
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function PspAnalyticsComponent({ pspId }: PspAnalyticsComponentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PspDetailsResponse | null>(null)
  const [usageTrendData, setUsageTrendData] = useState<PspUsageTrendData[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("30d")
  const [customRange, setCustomRange] = useState<PeriodRange | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [upcomingFundsData, setUpcomingFundsData] = useState<PspUpcomingFundsResponse | null>(null)
  const [loadingUpcomingFunds, setLoadingUpcomingFunds] = useState(false)

  const loadPspData = async () => {
    if (!pspId) return
    try {
      setError(null)
      const pspData = await getPspDetails(pspId)
      setData(pspData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      if (!pspId) return
      try {
        setLoading(true)
        await loadPspData()
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [pspId])

  useEffect(() => {
    if (!pspId) return
    const loadUsageData = async () => {
      try {
        let days: number | undefined = 30
        let fromDate: Date | undefined
        let toDate: Date | undefined
        if (selectedPeriod === 'custom' && customRange) {
          fromDate = customRange.from
          toDate = customRange.to
          days = undefined
        } else if (selectedPeriod === '24h') days = 1
        else if (selectedPeriod === '7d') days = 7
        else if (selectedPeriod === '30d') days = 30
        else if (selectedPeriod === '90d') days = 90
        const usageData = await getPspUsageTrend(pspId, days, fromDate, toDate)
        setUsageTrendData(usageData)
      } catch (err) {
        console.error('Failed to load usage trend:', err)
      }
    }
    loadUsageData()
  }, [pspId, selectedPeriod, customRange, data?.psp.monthlyCapacityEur, data?.psp.dailyCapacityEur])

  useEffect(() => {
    if (!pspId || !data?.psp.pspType || data.psp.pspType !== 'stripe') return
    const loadUpcomingFunds = async () => {
      try {
        setLoadingUpcomingFunds(true)
        const fundsData = await getPspUpcomingFunds(pspId)
        setUpcomingFundsData(fundsData)
      } catch (err) {
        console.error('Failed to load upcoming funds:', err)
      } finally {
        setLoadingUpcomingFunds(false)
      }
    }
    loadUpcomingFunds()
  }, [pspId, data?.psp.pspType])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPspData()
    const days = selectedPeriod === '24h' ? 1 : selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : 1
    const usageData = await getPspUsageTrend(pspId, days, customRange?.from, customRange?.to)
    setUsageTrendData(usageData)
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/psp"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="h-8 w-64 bg-muted/30 rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-5 pb-4"><div className="h-16 bg-muted/20 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/psp"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl font-bold">Erreur</h1>
        </div>
        <Card><CardContent className="pt-6"><p className="text-destructive">{error || 'Donnees non disponibles'}</p></CardContent></Card>
      </div>
    )
  }

  const { psp, lifetimeMetrics, thisMonthMetrics, keyRatios, stripeAccountDetails } = data

  const remainingCapacity = psp.monthlyCapacityEur
    ? Math.max(0, psp.monthlyCapacityEur - thisMonthMetrics.successVolume)
    : null
  const capacityPercent = psp.monthlyCapacityEur
    ? Math.min(100, (thisMonthMetrics.successVolume / psp.monthlyCapacityEur) * 100)
    : 0
  const approvalDiff = thisMonthMetrics.approvalRate - lifetimeMetrics.approvalRate

  // Chart data
  const chartData = usageTrendData.map(item => ({
    ...item,
    usageReal: item.usageReal / 100,
    dailyCapacity: item.dailyCapacity ? item.dailyCapacity / 100 : (data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : null),
    monthlyCapacity: item.monthlyCapacity ? item.monthlyCapacity / 100 : (data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : null),
  }))

  const chartConfig: ChartConfig = {
    usageReal: { label: "Volume", color: "#2859FF" },
    dailyCapacity: { label: "Cap 24h", color: "#10B981" },
    monthlyCapacity: { label: "Cap 30j", color: "#F59E0B" },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/psp"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-3">
            {psp.pspType === 'stripe' && <Image src="/stripe.png" alt="Stripe" width={28} height={28} className="object-contain" />}
            {psp.pspType === 'checkout' && <Image src="/checkout-com.jpg" alt="Checkout.com" width={28} height={28} className="object-contain rounded-full" />}
            {psp.pspType === 'paypal' && <Image src="/paypal.png" alt="PayPal" width={28} height={28} className="object-contain" />}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{psp.name}</h1>
                <Badge variant={psp.isActive ? 'default' : 'destructive'} className="text-[10px]">
                  {psp.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{psp.id}</span>
                <CopyButton text={psp.id} />
              </div>
            </div>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} size="sm" variant="outline">
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Taux d'approbation"
          value={`${thisMonthMetrics.approvalRate.toFixed(1)}%`}
          subtitle={`Lifetime: ${lifetimeMetrics.approvalRate.toFixed(1)}%`}
          icon={thisMonthMetrics.approvalRate >= 80 ? TrendingUp : TrendingDown}
          color={thisMonthMetrics.approvalRate >= 80 ? "emerald" : thisMonthMetrics.approvalRate >= 50 ? "amber" : "red"}
          trend={{ value: approvalDiff, label: "vs lifetime" }}
        />
        <StatCard
          label="Volume ce mois"
          value={formatCurrency(thisMonthMetrics.successVolume)}
          subtitle={`${thisMonthMetrics.successful} paiements reussis`}
          icon={CreditCard}
          color="primary"
        />
        <StatCard
          label="Volume lifetime"
          value={formatCurrency(lifetimeMetrics.successVolume)}
          subtitle={`${lifetimeMetrics.successful} / ${lifetimeMetrics.totalAttempts} tentatives`}
          icon={Zap}
          color="primary"
        />
        <StatCard
          label="Panier moyen"
          value={formatCurrency(keyRatios.avgTransaction)}
          subtitle={`${formatCurrency(keyRatios.volumePerDay)} / jour`}
          icon={ShieldCheck}
          color="emerald"
        />
      </div>

      {/* Capacity bar (if cap is set) */}
      {psp.monthlyCapacityEur && psp.monthlyCapacityEur > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Capacite mensuelle</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(thisMonthMetrics.successVolume)} / {formatCurrency(psp.monthlyCapacityEur)} utilises
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{capacityPercent.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">
                  {remainingCapacity !== null ? `${formatCurrency(remainingCapacity)} restants` : ''}
                </p>
              </div>
            </div>
            <Progress
              value={capacityPercent}
              className="h-2.5"
            />
            {psp.dailyCapacityEur && psp.dailyCapacityEur > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Limite quotidienne : {formatCurrency(psp.dailyCapacityEur)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Volume de traitement</CardTitle>
          <PeriodSelector
            value={selectedPeriod}
            customRange={customRange}
            onPeriodChange={setSelectedPeriod}
            onCustomRangeChange={setCustomRange}
          />
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="space-y-3">
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={50}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => { try { const [,m,d] = v.split('-'); return `${d}/${m}` } catch { return v } }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={55}
                    tickFormatter={(v) => v === 0 ? '0' : formatCurrency(v * 100)}
                    domain={[0, (dataMax: number) => {
                      const dc = data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : 0
                      const mc = data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : 0
                      const maxCap = Math.max(dc, mc)
                      return Math.max(dataMax || 0, maxCap || 100) * 1.2
                    }]}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg border bg-background p-2.5 shadow-sm text-sm">
                          <p className="text-xs text-muted-foreground mb-1.5">
                            {(() => { try { const [,m,day] = d.date.split('-'); return `${day}/${m}` } catch { return d.date } })()}
                          </p>
                          <p className="font-semibold">{formatCurrency(d.usageReal * 100)}</p>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey="usageReal" stroke="#2859FF" fill="#2859FF" fillOpacity={0.15} strokeWidth={2} />
                  {(() => {
                    const dc = data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : null
                    return dc && dc > 0 ? <ReferenceLine y={dc} stroke="#10B981" strokeWidth={2} strokeDasharray="6 3" /> : null
                  })()}
                  {(() => {
                    const mc = data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : null
                    return mc && mc > 0 ? <ReferenceLine y={mc} stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" /> : null
                  })()}
                </AreaChart>
              </ChartContainer>
              {/* Legend */}
              <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#2859FF]/30 border border-[#2859FF]" />
                  Volume
                </div>
                {data?.psp.dailyCapacityEur && data.psp.dailyCapacityEur > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-0 border-t-2 border-dashed border-[#10B981]" />
                    Cap 24h ({formatCurrency(data.psp.dailyCapacityEur)})
                  </div>
                )}
                {data?.psp.monthlyCapacityEur && data.psp.monthlyCapacityEur > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-0 border-t-2 border-dashed border-[#F59E0B]" />
                    Cap 30j ({formatCurrency(data.psp.monthlyCapacityEur)})
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Aucune donnee disponible
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Performance breakdown + Upcoming Funds / Stripe info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Repartition des paiements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Approval rate visual bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ce mois</span>
                <span className="font-medium">{thisMonthMetrics.successful} reussis / {thisMonthMetrics.failed} echecs</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {thisMonthMetrics.totalAttempts > 0 && (
                  <>
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${(thisMonthMetrics.successful / thisMonthMetrics.totalAttempts) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(thisMonthMetrics.failed / thisMonthMetrics.totalAttempts) * 100}%` }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lifetime</span>
                <span className="font-medium">{lifetimeMetrics.successful} reussis / {lifetimeMetrics.failed} echecs</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {lifetimeMetrics.totalAttempts > 0 && (
                  <>
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${(lifetimeMetrics.successful / lifetimeMetrics.totalAttempts) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(lifetimeMetrics.failed / lifetimeMetrics.totalAttempts) * 100}%` }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume reussi (mois)</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(thisMonthMetrics.successVolume)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume decline (mois)</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(thisMonthMetrics.declineVolume)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume reussi (total)</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(lifetimeMetrics.successVolume)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume decline (total)</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(lifetimeMetrics.declineVolume)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe: Upcoming Funds or Config */}
        {psp.pspType === 'stripe' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Fonds Stripe
              </CardTitle>
              {upcomingFundsData?.lastUpdated && (
                <span className="text-[10px] text-muted-foreground">
                  {upcomingFundsData.fromCache && <span className="text-emerald-500 mr-1">●</span>}
                  {new Date(upcomingFundsData.lastUpdated).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {loadingUpcomingFunds ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : upcomingFundsData ? (
                <div className="space-y-4">
                  {/* Balance cards */}
                  {upcomingFundsData.currentBalance && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Disponible</p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                          {upcomingFundsData.currentBalance.available.length > 0
                            ? upcomingFundsData.currentBalance.available.map(b => formatCurrency(b.amount, b.currency)).join(', ')
                            : '0,00 EUR'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">En attente</p>
                        <p className="text-lg font-bold text-amber-600 mt-1">
                          {upcomingFundsData.currentBalance.pending.length > 0
                            ? upcomingFundsData.currentBalance.pending.map(b => formatCurrency(b.amount, b.currency)).join(', ')
                            : '0,00 EUR'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Upcoming disbursements */}
                  {upcomingFundsData.upcomingFunds.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Prochains versements</p>
                      {(() => {
                        const grouped: Record<string, Array<{ currency: string; amount: number; transactionCount: number }>> = {}
                        upcomingFundsData.upcomingFunds.forEach(f => {
                          if (!grouped[f.availableOn]) grouped[f.availableOn] = []
                          grouped[f.availableOn].push({ currency: f.currency, amount: f.amount, transactionCount: f.transactionCount })
                        })
                        return Object.entries(grouped).map(([date, funds]) => (
                          <div key={date} className="flex items-center justify-between p-2.5 rounded-lg border">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              {funds.map((fund, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">{fund.transactionCount} tx</span>
                                  <span className="text-sm font-semibold font-mono">{formatCurrency(fund.amount, fund.currency)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun versement en attente</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Impossible de charger les donnees</p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Non-Stripe: show a simple config card */
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Type", value: psp.pspType.charAt(0).toUpperCase() + psp.pspType.slice(1) },
                  { label: "Statut", value: psp.isActive ? "Actif" : "Inactif" },
                  { label: "Cap mensuel", value: psp.monthlyCapacityEur ? formatCurrency(psp.monthlyCapacityEur) : "Illimite" },
                  { label: "Cap quotidien", value: psp.dailyCapacityEur ? formatCurrency(psp.dailyCapacityEur) : "Illimite" },
                  { label: "Cree le", value: new Date(psp.createdAt).toLocaleDateString('fr-FR') },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stripe Account Details (compact) */}
      {psp.pspType === 'stripe' && stripeAccountDetails && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compte Stripe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Mode",
                  content: <Badge variant={stripeAccountDetails.mode === 'live' ? 'default' : 'secondary'} className="text-[10px]">{stripeAccountDetails.mode === 'live' ? 'Live' : 'Test'}</Badge>
                },
                {
                  label: "Charges",
                  content: stripeAccountDetails.chargesEnabled
                    ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
                    : <span className="flex items-center gap-1 text-sm text-red-500"><XCircle className="h-3.5 w-3.5" />Inactive</span>
                },
                {
                  label: "Payouts",
                  content: stripeAccountDetails.payoutsEnabled
                    ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Actifs</span>
                    : <span className="flex items-center gap-1 text-sm text-red-500"><XCircle className="h-3.5 w-3.5" />Inactifs</span>
                },
                {
                  label: "Verification",
                  content: stripeAccountDetails.detailsSubmitted
                    ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Complete</span>
                    : <span className="flex items-center gap-1 text-sm text-amber-500"><Clock className="h-3.5 w-3.5" />En cours</span>
                },
              ].map(({ label, content }) => (
                <div key={label} className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                  {content}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              {[
                { label: "Entreprise", value: stripeAccountDetails.businessName || '-' },
                { label: "Type", value: stripeAccountDetails.businessType || '-' },
                { label: "Pays", value: stripeAccountDetails.country?.toUpperCase() || '-' },
                { label: "Devise", value: stripeAccountDetails.defaultCurrency?.toUpperCase() || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
