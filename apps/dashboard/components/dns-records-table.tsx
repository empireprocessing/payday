"use client"

import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  RefreshCw,
  Copy,
  Check,
  Clock,
  XCircle,
  Shield,
  Globe,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
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

type OverallStatus = 'active' | 'pending' | 'failed' | 'loading'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copie dans le presse-papiers')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erreur lors de la copie')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400 gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          Actif
        </Badge>
      )
    case 'pending':
    case 'pending_validation':
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400 gap-1.5">
          <Clock className="h-3 w-3" />
          En attente
        </Badge>
      )
    default:
      return (
        <Badge className="bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400 gap-1.5">
          <XCircle className="h-3 w-3" />
          Erreur
        </Badge>
      )
  }
}

function getOverallStatus(data: DnsRecordsData | null): OverallStatus {
  if (!data) return 'loading'
  const hostnameOk = data.status?.hostname === 'active'
  const sslOk = data.status?.ssl === 'active'
  const vercelOk = data.vercel?.info?.verified !== false
  if (hostnameOk && sslOk && vercelOk) return 'active'
  const hasErrors = data.status?.verificationErrors && data.status.verificationErrors.length > 0
  if (hasErrors) return 'failed'
  return 'pending'
}

export function DnsRecordsTable({ storeId, domainId, onStatusChange }: DnsRecordsTableProps) {
  const [dnsRecords, setDnsRecords] = useState<DnsRecordsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDnsRecords = async () => {
    try {
      setError(null)
      if (!storeId || !domainId) {
        setError('Store ID ou Domain ID manquant')
        setLoading(false)
        return
      }
      const records = await apiClient.payDomains.getDnsRecords(storeId, domainId)
      setDnsRecords(records)
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
      setError(err instanceof Error ? err.message : 'Impossible de charger les enregistrements DNS')
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement des enregistrements DNS...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Erreur de chargement</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <Button onClick={handleRefresh} size="sm" variant="outline">
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Reessayer
        </Button>
      </div>
    )
  }

  const overallStatus = getOverallStatus(dnsRecords)
  const records: DnsRecord[] = []
  if (dnsRecords?.cname) {
    records.push({
      type: dnsRecords.cname.type,
      host: dnsRecords.cname.host,
      target: dnsRecords.cname.target,
      value: dnsRecords.cname.target,
      description: dnsRecords.cname.description,
    })
  }
  if (dnsRecords?.ownershipVerification) records.push(dnsRecords.ownershipVerification)
  if (dnsRecords?.sslValidation) records.push(dnsRecords.sslValidation)
  if (dnsRecords?.dcvDelegation) {
    records.push({
      type: dnsRecords.dcvDelegation.type,
      host: dnsRecords.dcvDelegation.host,
      target: dnsRecords.dcvDelegation.target,
      value: dnsRecords.dcvDelegation.target,
      description: dnsRecords.dcvDelegation.description,
    })
  }

  return (
    <div className="space-y-5">
      {/* Header with overall status + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {overallStatus === 'active' ? (
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
          ) : overallStatus === 'failed' ? (
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {overallStatus === 'active' && 'Domaine actif'}
              {overallStatus === 'pending' && 'Configuration en attente'}
              {overallStatus === 'failed' && 'Erreur de configuration'}
            </p>
            <p className="text-xs text-muted-foreground">
              Donnees en temps reel depuis Cloudflare & Vercel
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* Status cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Cloudflare Hostname */}
        <div className="rounded-lg border bg-card p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domaine</span>
          </div>
          <div>
            {dnsRecords?.status ? (
              <StatusBadge status={dnsRecords.status.hostname} />
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </div>
        </div>

        {/* SSL */}
        <div className="rounded-lg border bg-card p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SSL</span>
          </div>
          <div>
            {dnsRecords?.status ? (
              <StatusBadge status={dnsRecords.status.ssl} />
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </div>
        </div>

        {/* Vercel */}
        <div className="rounded-lg border bg-card p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vercel</span>
          </div>
          <div>
            {dnsRecords?.vercel?.info !== undefined ? (
              <StatusBadge status={dnsRecords.vercel?.info?.verified ? 'active' : 'pending'} />
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </div>
        </div>
      </div>

      {/* Errors */}
      {dnsRecords?.status?.verificationErrors && dnsRecords.status.verificationErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">Erreurs de verification</p>
              <ul className="mt-1.5 space-y-1">
                {dnsRecords.status.verificationErrors.map((err, i) => (
                  <li key={i} className="text-xs text-red-700 dark:text-red-400/80">{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Vercel misconfigured warning */}
      {dnsRecords?.vercel?.config?.misconfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Configuration Vercel incorrecte</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                Le domaine est mal configure sur Vercel. Verifiez les enregistrements DNS ci-dessous.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vercel recommended DNS */}
      {dnsRecords?.vercel?.config && (dnsRecords.vercel.config.recommendedCNAME || dnsRecords.vercel.config.recommendedIPv4) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">DNS recommandes par Vercel</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Valeur</TableHead>
                  <TableHead className="text-xs w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnsRecords.vercel.config.recommendedCNAME && (
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">CNAME</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-foreground break-all">
                        {dnsRecords.vercel.config.recommendedCNAME}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CopyButton text={dnsRecords.vercel.config.recommendedCNAME} />
                    </TableCell>
                  </TableRow>
                )}
                {dnsRecords.vercel.config.recommendedIPv4?.map((ip, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">A</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-foreground">{ip}</span>
                    </TableCell>
                    <TableCell>
                      <CopyButton text={ip} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Current DNS (if available) */}
      {dnsRecords?.vercel?.config && (dnsRecords.vercel.config.currentCNAME || (dnsRecords.vercel.config.currentA && dnsRecords.vercel.config.currentA.length > 0)) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">DNS actuellement detectes</h3>
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Valeur actuelle</TableHead>
                  <TableHead className="text-xs">Attendu</TableHead>
                  <TableHead className="text-xs w-[50px]">Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnsRecords.vercel.config.currentCNAME && (
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">CNAME</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{dnsRecords.vercel.config.currentCNAME}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {dnsRecords.vercel.config.recommendedCNAME || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {dnsRecords.vercel.config.currentCNAME === dnsRecords.vercel.config.recommendedCNAME ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 inline" />
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {dnsRecords.vercel.config.currentA?.map((ip, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">A</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{ip}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {dnsRecords.vercel?.config?.recommendedIPv4?.[idx] || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {dnsRecords.vercel?.config?.recommendedIPv4?.includes(ip) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 inline" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
