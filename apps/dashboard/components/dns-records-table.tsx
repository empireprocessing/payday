"use client"

import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Copy, Check, Clock, X } from "lucide-react"
import { toast } from "sonner"

interface DnsRecord {
  type: string
  host: string
  value?: string
  target?: string
  description: string
}

interface DnsRecordsData {
  cname?: DnsRecord
  ownershipVerification?: DnsRecord
  sslValidation?: DnsRecord
  dcvDelegation?: DnsRecord
  status?: {
    hostname: string
    ssl: string
    verificationErrors?: string[]
  }
  vercel?: {
    info?: {
      verified: boolean
      createdAt: number
      updatedAt: number
    } | null
    config?: {
      configuredBy: string
      misconfigured: boolean
      nameservers: string[]
      serviceType: string
      recommendedCNAME: string | null
      recommendedIPv4: string[] | null
      currentCNAME: string | null
      currentA: string[] | null
    } | null
  }
}

interface DnsRecordsTableProps {
  storeId: string
  domainId: string
  onStatusChange?: (status: 'PENDING' | 'ACTIVE' | 'FAILED') => void
}

export function DnsRecordsTable({ storeId, domainId, onStatusChange }: DnsRecordsTableProps) {
  const [dnsRecords, setDnsRecords] = useState<DnsRecordsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copié dans le presse-papiers')
    } catch (err) {
      console.error('Failed to copy text: ', err)
      toast.error('Erreur lors de la copie')
    }
  }

  const fetchDnsRecords = async () => {
    try {
      setError(null)
      
      // Vérifier que les IDs sont valides
      if (!storeId || !domainId) {
        setError('Store ID ou Domain ID manquant')
        setLoading(false)
        return
      }
      
      const records = await apiClient.payDomains.getDnsRecords(storeId, domainId)
      console.log('[DnsRecordsTable] Fetched records:', records)
      setDnsRecords(records)
      
      // Notifier du changement de statut
      if (onStatusChange && records.status) {
        if (records.status.hostname === 'active' && records.status.ssl === 'active') {
          onStatusChange('ACTIVE')
        } else if (records.status.verificationErrors && records.status.verificationErrors.length > 0) {
          onStatusChange('FAILED')
        } else {
          onStatusChange('PENDING')
        }
      }
    } catch (err) {
      console.error('Failed to fetch DNS records:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch DNS records')
      if (onStatusChange) onStatusChange('FAILED')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDnsRecords()
  }, [storeId, domainId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDnsRecords()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="h-3 w-3 text-green-500" />
      case 'pending':
      case 'pending_validation':
        return <Clock className="h-3 w-3 text-yellow-500" />
      default:
        return <X className="h-3 w-3 text-red-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700'
      case 'pending':
      case 'pending_validation':
        return 'text-yellow-700'
      default:
        return 'text-red-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 p-6">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Chargement des DNS records...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-sm text-destructive font-medium">Erreur</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <Button onClick={handleRefresh} size="sm" variant="outline" className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    )
  }

  const records: DnsRecord[] = []
  if (dnsRecords?.cname) {
    records.push({
      type: dnsRecords.cname.type,
      host: dnsRecords.cname.host,
      target: dnsRecords.cname.target,
      value: dnsRecords.cname.target, // Pour CNAME, utiliser target comme value
      description: dnsRecords.cname.description
    })
  }
  if (dnsRecords?.ownershipVerification) records.push(dnsRecords.ownershipVerification)
  if (dnsRecords?.sslValidation) records.push(dnsRecords.sslValidation)
  if (dnsRecords?.dcvDelegation) {
    records.push({
      type: dnsRecords.dcvDelegation.type,
      host: dnsRecords.dcvDelegation.host,
      target: dnsRecords.dcvDelegation.target,
      value: dnsRecords.dcvDelegation.target, // Pour CNAME, utiliser target comme value
      description: dnsRecords.dcvDelegation.description
    })
  }

  return (
    <div className="space-y-3">
      {/* Section de refresh */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          DNS records requis (données en temps réel depuis Cloudflare)
        </p>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
          variant="outline"
        >
          {refreshing ? (
            <>
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
              Actualisation...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-2" />
              Actualiser
            </>
          )}
        </Button>
      </div>

      {/* Statut global */}
      <div className={`grid gap-3 ${dnsRecords?.status && dnsRecords?.vercel ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Statut Cloudflare */}
        {dnsRecords?.status && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Statut Cloudflare</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Domaine :</span>
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(dnsRecords.status.hostname)}
                  <span className={`text-xs font-medium ${getStatusColor(dnsRecords.status.hostname)}`}>
                    {dnsRecords.status.hostname}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">SSL :</span>
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(dnsRecords.status.ssl)}
                  <span className={`text-xs font-medium ${getStatusColor(dnsRecords.status.ssl)}`}>
                    {dnsRecords.status.ssl}
                  </span>
                </div>
              </div>
              
              {dnsRecords.status.verificationErrors && dnsRecords.status.verificationErrors.length > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                  <p className="font-medium text-destructive mb-1">Erreurs :</p>
                  <ul className="text-destructive/90 space-y-0.5">
                    {dnsRecords.status.verificationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Statut Vercel */}
        {dnsRecords?.vercel && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Statut Vercel</CardTitle>
                {dnsRecords.vercel.info && (
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(dnsRecords.vercel.info.verified ? 'active' : 'pending')}
                    <span className={`text-xs font-medium ${getStatusColor(dnsRecords.vercel.info.verified ? 'active' : 'pending')}`}>
                      {dnsRecords.vercel.info.verified ? 'Vérifié' : 'En attente'}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dnsRecords.vercel.config && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Configuration :</span>
                    <span className="text-xs font-mono font-medium text-foreground">{dnsRecords.vercel.config.configuredBy}</span>
                    {dnsRecords.vercel.config.misconfigured && (
                      <span className="text-xs text-destructive font-medium">⚠️ Mal configuré</span>
                    )}
                  </div>

                  {/* DNS recommandés par Vercel */}
                  {(dnsRecords.vercel.config.recommendedCNAME || dnsRecords.vercel.config.recommendedIPv4) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">DNS recommandés :</p>
                      
                      {dnsRecords.vercel.config.recommendedCNAME && (
                        <div className="p-2 bg-muted/50 border border-border rounded">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground mb-1">CNAME</div>
                              <div className="font-mono text-xs text-foreground break-all">{dnsRecords.vercel.config.recommendedCNAME}</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={() => copyToClipboard(dnsRecords.vercel?.config?.recommendedCNAME ?? '')}
                              title="Copier le CNAME"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {dnsRecords.vercel.config.recommendedIPv4 && dnsRecords.vercel.config.recommendedIPv4.length > 0 && (
                        <div className="p-2 bg-muted/50 border border-border rounded">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground mb-1">A Records</div>
                              <div className="font-mono text-xs text-foreground">
                                {dnsRecords.vercel.config.recommendedIPv4.map((ip, idx) => (
                                  <div key={idx}>{ip}</div>
                                ))}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={() => copyToClipboard(dnsRecords.vercel?.config?.recommendedIPv4?.join('\n') ?? '')}
                              title="Copier les adresses IP"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DNS actuels (si disponibles) */}
                  {(dnsRecords.vercel.config.currentCNAME || dnsRecords.vercel.config.currentA) && (
                    <div className="p-2 bg-muted/30 border border-border rounded">
                      <p className="text-xs font-medium text-foreground mb-1">DNS actuels :</p>
                      <div className="space-y-1 text-xs">
                        {dnsRecords.vercel.config.currentCNAME && (
                          <div className="font-mono text-muted-foreground">
                            <span className="text-foreground">CNAME:</span> {dnsRecords.vercel.config.currentCNAME}
                          </div>
                        )}
                        {dnsRecords.vercel.config.currentA && dnsRecords.vercel.config.currentA.length > 0 && (
                          <div className="font-mono text-muted-foreground">
                            <span className="text-foreground">A:</span> {dnsRecords.vercel.config.currentA.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table des DNS records */}
      {records.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">DNS Records à configurer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-medium text-foreground pb-2 pr-3">Nom</th>
                    <th className="text-left font-medium text-foreground pb-2 pr-3">Type</th>
                    <th className="text-left font-medium text-foreground pb-2 pr-4">Valeur</th>
                    <th className="text-left font-medium text-foreground pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr key={index} className={index < records.length - 1 ? "border-b border-border/50" : ""}>
                      <td className="text-foreground py-2 pr-3 font-mono" title={record.description}>
                        {record.host}
                      </td>
                      <td className="text-foreground py-2 pr-3">
                        <span className="px-1.5 py-0.5 bg-muted rounded text-xs font-medium">{record.type}</span>
                      </td>
                      <td className="text-foreground py-2 pr-4 font-mono break-all">
                        {record.value || record.target || '-'}
                      </td>
                      <td className="text-foreground py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(record.value || record.target || record.host || '')}
                          title="Copier la valeur"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}