"use client"

import { useState, useEffect } from "react"
import { getPspDetails, getPspUsageTrend, getPspUpcomingFunds, type PspUsageTrendData, type PspUpcomingFundsResponse } from "@/lib/actions"
import { formatCurrency, formatCurrencyNoDecimals } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Copy, CheckCircle2, XCircle, Eye, EyeOff, RefreshCw, Calendar, Wallet } from "lucide-react"
import Link from "next/link"
import type { PspDetailsResponse } from "@/lib/actions"
import Image from "next/image"
import {
  XAxis, YAxis, Area, AreaChart, CartesianGrid, Line, ReferenceLine
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart"
import { PeriodSelector, type PeriodType, type PeriodRange } from "@/components/period-selector"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PspAnalyticsComponentProps {
  pspId: string;
}

export function PspAnalyticsComponent({ pspId }: PspAnalyticsComponentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PspDetailsResponse | null>(null)
  const [usageTrendData, setUsageTrendData] = useState<PspUsageTrendData[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("24h")
  const [customRange, setCustomRange] = useState<PeriodRange | undefined>(undefined)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [upcomingFundsData, setUpcomingFundsData] = useState<PspUpcomingFundsResponse | null>(null)
  const [loadingUpcomingFunds, setLoadingUpcomingFunds] = useState(false)

  const loadPspData = async () => {
    if (!pspId) return
    
    try {
      setError(null)
      
      const pspData = await getPspDetails(pspId)
      console.log('[PspAnalytics] PSP details loaded:', {
        id: pspData.psp.id,
        dailyCapacityEur: pspData.psp.dailyCapacityEur,
        monthlyCapacityEur: pspData.psp.monthlyCapacityEur
      })
      setData(pspData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      console.error('Failed to load PSP analytics:', err)
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

  // Charger les données d'usage avec la période sélectionnée
  useEffect(() => {
    if (!pspId) return
    
    const loadUsageData = async () => {
      try {
        // Calculer la période et les jours selon le type sélectionné
        let days: number | undefined = 1; // Par défaut : 24h
        let fromDate: Date | undefined = undefined;
        let toDate: Date | undefined = undefined;
        
        if (selectedPeriod === 'custom' && customRange) {
          // Pour une période personnalisée
          fromDate = customRange.from;
          toDate = customRange.to;
        } else if (selectedPeriod === '24h') {
          days = 1;
        } else if (selectedPeriod === '7d') {
          days = 7;
        } else if (selectedPeriod === '30d') {
          days = 30;
        } else if (selectedPeriod === '90d') {
          days = 90;
        }

        const usageData = await getPspUsageTrend(pspId, days, fromDate, toDate)
        console.log('[PspAnalytics] Usage trend data loaded:', usageData)
        console.log('[PspAnalytics] Daily capacity values:', usageData.map(d => ({ date: d.date, dailyCapacity: d.dailyCapacity })))
        console.log('[PspAnalytics] Monthly capacity values:', usageData.map(d => ({ date: d.date, monthlyCapacity: d.monthlyCapacity })))
        console.log('[PspAnalytics] Has daily capacity?', usageData.some(d => d.dailyCapacity !== null && d.dailyCapacity !== undefined && d.dailyCapacity > 0))
        console.log('[PspAnalytics] Has monthly capacity?', usageData.some(d => d.monthlyCapacity !== null && d.monthlyCapacity !== undefined && d.monthlyCapacity > 0))
        setUsageTrendData(usageData)
      } catch (err) {
        console.error('Failed to load usage trend:', err)
      }
    }

    loadUsageData()
  }, [pspId, selectedPeriod, customRange, data?.psp.monthlyCapacityEur, data?.psp.dailyCapacityEur])

  // Charger les fonds à venir (uniquement pour Stripe)
  useEffect(() => {
    if (!pspId || !data?.psp.pspType) return
    if (data.psp.pspType !== 'stripe') return

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

  const handleCopyId = () => {
    if (data?.psp.id) {
      navigator.clipboard.writeText(data.psp.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/psp">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="h-8 w-64 bg-muted/30 rounded animate-pulse"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="glassmorphism animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-muted/30 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 bg-muted/30 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/psp">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Erreur</h1>
        </div>
        <Card className="glassmorphism">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'Données non disponibles'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { psp, lifetimeMetrics, thisMonthMetrics, keyRatios, stripeAccountDetails } = data

  // Calculer la capacité restante (monthlyCapacityEur est en centimes, successVolume aussi)
  // monthlyCapacityEur est stocké en centimes (ex: 100000 = 1000€)
  const remainingCapacity = psp.monthlyCapacityEur 
    ? Math.max(0, psp.monthlyCapacityEur - thisMonthMetrics.successVolume)
    : null

  // Formater la clé publique pour l'affichage (masquer) - afficher les 8 premiers caractères + 4 astérisques
  const maskedPublicKey = psp.publicKey ? `${psp.publicKey.substring(0, 8)}****` : 'N/A'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/psp">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {psp.pspType === 'stripe' && (
              <Image src="/stripe.png" alt="Stripe" width={32} height={32} className="object-contain" />
            )}
            {psp.pspType === 'checkout' && (
              <Image src="/checkout-com.jpg" alt="Checkout.com" width={32} height={32} className="object-contain rounded-full" />
            )}
            {psp.pspType === 'paypal' && (
              <Image src="/paypal.png" alt="PayPal" width={32} height={32} className="object-contain" />
            )}
            <div>
              <h1 className="text-3xl font-bold">{psp.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">ID: {psp.id}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    setRefreshing(true)
                    await loadPspData()
                    // Recharger aussi les données d'usage
                    const days = selectedPeriod === '24h' ? 1 : selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : 1
                    const usageData = await getPspUsageTrend(pspId, days, customRange?.from, customRange?.to)
                    setUsageTrendData(usageData)
                    setRefreshing(false)
                  }}
                  disabled={refreshing}
                  title="Actualiser les données"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={handleCopyId}
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/psp`}>Modifier</Link>
          </Button>
        </div>
      </div>

      {/* Performance Analytics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lifetimeMetrics.approvalRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lifetimeMetrics.successVolume)}</div>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonthMetrics.approvalRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(thisMonthMetrics.successVolume)}</div>
          </CardContent>
        </Card>

        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {remainingCapacity !== null ? formatCurrency(remainingCapacity) : 'No Limit'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trend Chart */}
      <Card className="glassmorphism glow-subtle">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Usage & Capacity Trends</CardTitle>
          <div className="flex items-center gap-4">
            <PeriodSelector
              value={selectedPeriod}
              customRange={customRange}
              onPeriodChange={setSelectedPeriod}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </CardHeader>
        <CardContent>
          {usageTrendData.length > 0 ? (
            <div className="space-y-4">
            <ChartContainer
              config={{
                usageReal: {
                  label: "Usage réel (€)",
                  color: "#2859FF",
                },
                dailyCapacity: {
                  label: "Capacité 24h (€)",
                  color: "#10B981",
                },
                monthlyCapacity: {
                  label: "Capacité 30j (€)",
                  color: "#F59E0B",
                },
                usage24hCapPercent: {
                  label: "Usage 24h / Cap. (%)",
                  color: "#10B981",
                },
                usage30jCapPercent: {
                  label: "Usage 30j / Cap. (%)",
                  color: "#F59E0B",
                },
              } satisfies ChartConfig}
              className="h-[350px] w-full"
            >
              <AreaChart
                key={`usage-trend-${selectedPeriod}-${customRange?.from?.getTime()}-${customRange?.to?.getTime()}-${data?.psp.dailyCapacityEur}-${data?.psp.monthlyCapacityEur}`}
                data={(() => {
                  // Utiliser les capacités depuis data.psp si elles ne sont pas dans usageTrendData
                  const dailyCapacityValue = data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : null
                  const monthlyCapacityValue = data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : null
                  
                  const transformed = usageTrendData.map(item => ({
                    ...item,
                    // Convertir de centimes en euros pour l'affichage
                    usageReal: item.usageReal / 100,
                    // Utiliser la capacité depuis data.psp si elle n'est pas dans les données
                    dailyCapacity: item.dailyCapacity ? item.dailyCapacity / 100 : dailyCapacityValue,
                    monthlyCapacity: item.monthlyCapacity ? item.monthlyCapacity / 100 : monthlyCapacityValue,
                  }))
                  
                  return transformed
                })()}
                margin={{ top: 20, right: 20, left: 8, bottom: 32 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  minTickGap={60}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(value) => {
                    try {
                      // value est au format "YYYY-MM-DD"
                      const [year, month, day] = value.split('-')
                      return `${day}/${month}`
                    } catch {
                      return value
                    }
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={60}
                  tickFormatter={(value) => {
                    if (value === 0) return '0'
                    return `${value.toFixed(1)}%`
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={60}
                  tickFormatter={(value) => {
                    if (value === 0) return '0€'
                    // Les valeurs sont déjà en euros maintenant, donc on multiplie par 100 pour formatCurrency
                    return formatCurrency(value * 100)
                  }}
                  domain={[
                    0,
                    (dataMax: number) => {
                      // Inclure la capacité dans le domaine pour qu'elle soit toujours visible
                      const dailyCapacityValue = data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : 0
                      const monthlyCapacityValue = data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : 0
                      const maxCapacity = Math.max(dailyCapacityValue, monthlyCapacityValue)
                      
                      // Si aucune capacité n'est définie, utiliser une échelle par défaut raisonnable
                      if (maxCapacity === 0) {
                        // Utiliser une échelle par défaut de 100€ minimum pour avoir une échelle visible
                        // Si dataMax est supérieur, l'utiliser avec une marge
                        const effectiveMax = Math.max(dataMax || 0, 100)
                        return effectiveMax * 1.2
                      }
                      
                      // Prendre le maximum entre les données et la capacité, avec une marge de 20%
                      return Math.max(dataMax || 0, maxCapacity) * 1.2
                    }
                  ]}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-muted-foreground">
                              {(() => {
                                try {
                                  const [year, month, day] = data.date.split('-')
                                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                                  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                } catch {
                                  return data.date
                                }
                              })()}
                            </span>
                          </div>
                          {payload.map((entry, index) => {
                            if (entry.dataKey === 'usageReal') {
                              return (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <span className="text-xs" style={{ color: entry.color }}>
                                    {entry.name || 'Usage réel'}
                                  </span>
                                  <span className="text-sm font-semibold text-white">
                                    {/* Les valeurs sont déjà en euros, donc on multiplie par 100 pour formatCurrency */}
                                    {formatCurrency((entry.value as number) * 100)}
                                  </span>
                                </div>
                              )
                            } else if (entry.dataKey === 'dailyCapacity' || entry.dataKey === 'monthlyCapacity') {
                              const value = entry.value as number | null;
                              if (value === null || value === undefined) return null;
                              return (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <span className="text-xs" style={{ color: entry.color }}>
                                    {entry.dataKey === 'dailyCapacity' ? 'Capacité 24h' : 'Capacité 30j'}
                                  </span>
                                  <span className="text-sm font-semibold text-white">
                                    {/* Les valeurs sont déjà en euros, donc on multiplie par 100 pour formatCurrency */}
                                    {formatCurrency(value * 100)}
                                  </span>
                                </div>
                              )
                            } else {
                              return (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <span className="text-xs" style={{ color: entry.color }}>
                                    {entry.name || entry.dataKey}
                                  </span>
                                  <span className="text-sm font-semibold text-white">
                                    {(entry.value as number).toFixed(2)}%
                                  </span>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )
                  }}
                />
                {/* Usage réel */}
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="usageReal"
                  stroke="#2859FF"
                  fill="#2859FF"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                {/* Capacité quotidienne (ligne horizontale de référence) */}
                {(() => {
                  const dailyCapacityValue = data?.psp.dailyCapacityEur ? data.psp.dailyCapacityEur / 100 : null
                  return dailyCapacityValue && dailyCapacityValue > 0 && (
                    <ReferenceLine
                      yAxisId="right"
                      y={dailyCapacityValue}
                      stroke="#10B981"
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      label={{
                        value: formatCurrency(data.psp.dailyCapacityEur ?? 0),
                        position: "right", 
                        fill: "#10B981", 
                        fontSize: 12,
                        fontWeight: "bold"
                      }}
                    />
                  )
                })()}
                {/* Capacité mensuelle (ligne horizontale de référence) */}
                {(() => {
                  const monthlyCapacityValue = data?.psp.monthlyCapacityEur ? data.psp.monthlyCapacityEur / 100 : null
                  return monthlyCapacityValue && monthlyCapacityValue > 0 && (
                    <ReferenceLine
                      yAxisId="right"
                      y={monthlyCapacityValue}
                      stroke="#F59E0B"
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      label={{
                        value: formatCurrency(data.psp.monthlyCapacityEur ?? 0),
                        position: "right", 
                        fill: "#F59E0B", 
                        fontSize: 12,
                        fontWeight: "bold"
                      }}
                    />
                  )
                })()}
              </AreaChart>
            </ChartContainer>
            {/* Légende des capacités */}
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-border/50">
              {data?.psp.dailyCapacityEur && data.psp.dailyCapacityEur > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 border-t-2 border-dashed border-[#10B981]"></div>
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-[#10B981]">Ligne verte</span> : Capacité quotidienne (24h) - {formatCurrency(data.psp.dailyCapacityEur)}
                  </span>
                </div>
              )}
              {data?.psp.monthlyCapacityEur && data.psp.monthlyCapacityEur > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 border-t-2 border-dashed border-[#F59E0B]"></div>
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-[#F59E0B]">Ligne orange</span> : Capacité mensuelle (30j) - {formatCurrency(data.psp.monthlyCapacityEur)}
                  </span>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary Table */}
      <Card className="glassmorphism glow-subtle">
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 font-semibold">Metric</th>
                  <th className="text-right py-3 px-4 font-semibold">Lifetime Performance</th>
                  <th className="text-right py-3 px-4 font-semibold">This Month</th>
                  <th className="text-right py-3 px-4 font-semibold">Key Ratios</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Total Attempts</td>
                  <td className="text-right py-3 px-4">{lifetimeMetrics.totalAttempts}</td>
                  <td className="text-right py-3 px-4">{thisMonthMetrics.totalAttempts}</td>
                  <td className="text-right py-3 px-4">{keyRatios.totalAttempts}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Successful</td>
                  <td className="text-right py-3 px-4">{lifetimeMetrics.successful}</td>
                  <td className="text-right py-3 px-4">{thisMonthMetrics.successful}</td>
                  <td className="text-right py-3 px-4">{keyRatios.successful}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Failed</td>
                  <td className="text-right py-3 px-4">{lifetimeMetrics.failed}</td>
                  <td className="text-right py-3 px-4">{thisMonthMetrics.failed}</td>
                  <td className="text-right py-3 px-4">{keyRatios.failed}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Total Volume</td>
                  <td className="text-right py-3 px-4">{formatCurrency(lifetimeMetrics.totalVolume)}</td>
                  <td className="text-right py-3 px-4">{formatCurrency(thisMonthMetrics.totalVolume)}</td>
                  <td className="text-right py-3 px-4">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Success Volume</td>
                  <td className="text-right py-3 px-4">{formatCurrency(lifetimeMetrics.successVolume)}</td>
                  <td className="text-right py-3 px-4">{formatCurrency(thisMonthMetrics.successVolume)}</td>
                  <td className="text-right py-3 px-4">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Decline Volume</td>
                  <td className="text-right py-3 px-4">{formatCurrency(lifetimeMetrics.declineVolume)}</td>
                  <td className="text-right py-3 px-4">{formatCurrency(thisMonthMetrics.declineVolume)}</td>
                  <td className="text-right py-3 px-4">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4">Avg Transaction</td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4">{formatCurrency(keyRatios.avgTransaction)}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Volume per Day</td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4">{formatCurrency(keyRatios.volumePerDay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Funds - Fonds à venir (Stripe uniquement) */}
      {psp.pspType === 'stripe' && (
        <Card className="glassmorphism glow-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Fonds à venir
            </CardTitle>
            {upcomingFundsData?.lastUpdated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {upcomingFundsData.fromCache && (
                        <span className="text-emerald-500">●</span>
                      )}
                      {new Date(upcomingFundsData.lastUpdated).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{upcomingFundsData.fromCache ? 'Données en cache' : 'Données fraîches de Stripe'}</p>
                    <p className="text-xs text-muted-foreground">Cache valide 3h</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardHeader>
          <CardContent>
            {loadingUpcomingFunds ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : upcomingFundsData ? (
              <div className="space-y-6">
                {/* Balance actuelle */}
                {upcomingFundsData.currentBalance && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Disponible maintenant */}
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="text-sm text-muted-foreground mb-2">Disponible maintenant</div>
                      <div className="space-y-1">
                        {upcomingFundsData.currentBalance.available.length > 0 ? (
                          upcomingFundsData.currentBalance.available.map((balance, idx) => (
                            <div key={idx} className="text-lg font-semibold text-green-500">
                              {formatCurrency(balance.amount, balance.currency)}
                            </div>
                          ))
                        ) : (
                          <div className="text-lg font-semibold text-muted-foreground">0,00 EUR</div>
                        )}
                      </div>
                    </div>
                    {/* En attente (total) */}
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="text-sm text-muted-foreground mb-2">En attente (total)</div>
                      <div className="space-y-1">
                        {upcomingFundsData.currentBalance.pending.length > 0 ? (
                          upcomingFundsData.currentBalance.pending.map((balance, idx) => (
                            <div key={idx} className="text-lg font-semibold text-yellow-500">
                              {formatCurrency(balance.amount, balance.currency)}
                            </div>
                          ))
                        ) : (
                          <div className="text-lg font-semibold text-muted-foreground">0,00 EUR</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fonds à venir par date */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-3">Prochaines disponibilités</div>
                  {upcomingFundsData.upcomingFunds.length > 0 ? (
                    <div className="space-y-2">
                      {/* Grouper par date */}
                      {(() => {
                        const groupedByDate: Record<string, Array<{ currency: string; amount: number; transactionCount: number }>> = {};
                        upcomingFundsData.upcomingFunds.forEach(fund => {
                          if (!groupedByDate[fund.availableOn]) {
                            groupedByDate[fund.availableOn] = [];
                          }
                          groupedByDate[fund.availableOn].push({
                            currency: fund.currency,
                            amount: fund.amount,
                            transactionCount: fund.transactionCount,
                          });
                        });

                        return Object.entries(groupedByDate).map(([date, funds]) => (
                          <div key={date} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {new Date(date).toLocaleDateString('fr-FR', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {funds.map((fund, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    ({fund.transactionCount} tx)
                                  </span>
                                  <Badge variant="outline" className="font-mono">
                                    {formatCurrency(fund.amount, fund.currency)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Aucun fonds en attente
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Impossible de charger les données de balance
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stripe Account Configuration (si Stripe) */}
      {psp.pspType === 'stripe' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glassmorphism glow-subtle">
            <CardHeader>
              <CardTitle>Stripe Account Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Mode</span>
                  <Badge variant={stripeAccountDetails?.mode === 'live' ? 'default' : 'secondary'}>
                    {stripeAccountDetails?.mode === 'live' ? 'Live Mode' : 'Test Mode'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Account ID</span>
                  <span className="text-sm font-mono">{stripeAccountDetails?.accountId || psp.publicKey}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Public Key</span>
                  <span className="text-sm font-mono">{maskedPublicKey}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Account status</span>
                  <Badge variant={psp.isActive ? 'default' : 'destructive'}>
                    {psp.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Base Currency</span>
                  <span className="text-sm">{stripeAccountDetails?.defaultCurrency?.toUpperCase() || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Monthly Processing Capacity</span>
                  <span className="text-sm">
                    {psp.monthlyCapacityEur ? formatCurrency(psp.monthlyCapacityEur) : 'No Limit'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Created At</span>
                  <span className="text-sm">{new Date(psp.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Updated At</span>
                  <span className="text-sm">{new Date(psp.updatedAt).toLocaleString('fr-FR')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Account Details */}
          {stripeAccountDetails && (
            <Card className="glassmorphism glow-subtle">
              <CardHeader>
                <CardTitle>Stripe Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Business Name</span>
                    <span className="text-sm">{stripeAccountDetails.businessName || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Business Type</span>
                    <span className="text-sm">{stripeAccountDetails.businessType || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Country</span>
                    <span className="text-sm">{stripeAccountDetails.country?.toUpperCase() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Default Currency</span>
                    <span className="text-sm">{stripeAccountDetails.defaultCurrency?.toUpperCase() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Charges Enabled</span>
                    <Badge variant={stripeAccountDetails.chargesEnabled ? 'default' : 'destructive'}>
                      {stripeAccountDetails.chargesEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Payouts Enabled</span>
                    <Badge variant={stripeAccountDetails.payoutsEnabled ? 'default' : 'destructive'}>
                      {stripeAccountDetails.payoutsEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-muted-foreground">Details Submitted</span>
                    <Badge variant={stripeAccountDetails.detailsSubmitted ? 'default' : 'secondary'}>
                      {stripeAccountDetails.detailsSubmitted ? 'Submitted' : 'Not Submitted'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
