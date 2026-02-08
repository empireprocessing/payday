"use client"

import { useEffect, useState, useCallback, useMemo, Fragment } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Banknote, RefreshCw, ChevronDown, User } from "lucide-react"
import type { PaymentRecord, PaginatedPayments } from "@/lib/types"
import type { Store, PSPWithStoreCount } from "@/lib/types"
import { getAllPayments, getAllStores, getAllPsps } from "@/lib/actions"

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-green-500/20 text-green-400",
  FAILED: "bg-red-500/20 text-red-400",
  PENDING: "bg-yellow-500/20 text-yellow-400",
  PROCESSING: "bg-blue-500/20 text-blue-400",
  REFUNDED: "bg-purple-500/20 text-purple-400",
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SkeletonRow() {
  return (
    <TableRow className="border-b border-white/5">
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-white/10 rounded animate-pulse w-24" />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function PaymentsList() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [stores, setStores] = useState<Store[]>([])
  const [psps, setPsps] = useState<PSPWithStoreCount[]>([])

  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterStore, setFilterStore] = useState<string>("all")
  const [filterPsp, setFilterPsp] = useState<string>("all")
  const [filterRunner, setFilterRunner] = useState<string>("all")

  // Runners uniques extraits des stores (se met à jour quand les stores changent)
  const uniqueRunners = useMemo(() => {
    const runners = stores
      .map(s => s.runner)
      .filter((r): r is string => !!r && r.trim() !== "")
    return [...new Set(runners)].sort()
  }, [stores])

  // Stores filtrés par runner sélectionné
  const filteredStores = useMemo(() => {
    if (filterRunner === "all") return stores
    return stores.filter(s => s.runner === filterRunner)
  }, [stores, filterRunner])

  // Store IDs correspondant au runner sélectionné
  const runnerStoreIds = useMemo(() => {
    if (filterRunner === "all") return null
    return stores.filter(s => s.runner === filterRunner).map(s => s.id)
  }, [stores, filterRunner])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const result: PaginatedPayments = await getAllPayments({
        page,
        limit,
        status: filterStatus !== "all" ? filterStatus : undefined,
        storeId: filterStore !== "all" ? filterStore : undefined,
        storeIds: filterStore === "all" && runnerStoreIds ? runnerStoreIds : undefined,
        pspId: filterPsp !== "all" ? filterPsp : undefined,
      })
      setPayments(result.data)
      setTotal(result.total)
    } catch (error) {
      console.error("Failed to fetch payments:", error)
    } finally {
      setLoading(false)
    }
  }, [page, limit, filterStatus, filterStore, filterPsp, runnerStoreIds])

  useEffect(() => {
    async function loadFilters() {
      try {
        const [storesData, pspsData] = await Promise.all([
          getAllStores(),
          getAllPsps(),
        ])
        setStores(storesData)
        setPsps(pspsData)
      } catch (error) {
        console.error("Failed to load filters:", error)
      }
    }
    loadFilters()
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  // Reset store filter si le store sélectionné n'appartient pas au runner
  useEffect(() => {
    if (filterRunner !== "all" && filterStore !== "all") {
      const store = stores.find(s => s.id === filterStore)
      if (store && store.runner !== filterRunner) {
        setFilterStore("all")
      }
    }
  }, [filterRunner, filterStore, stores])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterStatus, filterStore, filterPsp, filterRunner])

  const totalPages = Math.ceil(total / limit)

  return (
    <Card className="glassmorphism-strong p-6 glow-subtle">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={filterRunner} onValueChange={setFilterRunner}>
          <SelectTrigger className="w-[200px] glassmorphism">
            <SelectValue placeholder="Runner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les runners</SelectItem>
            {uniqueRunners.map((runner) => (
              <SelectItem key={runner} value={runner}>
                {runner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-[200px] glassmorphism">
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les stores</SelectItem>
            {filteredStores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPsp} onValueChange={setFilterPsp}>
          <SelectTrigger className="w-[200px] glassmorphism">
            <SelectValue placeholder="PSP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les PSP</SelectItem>
            {psps.map((psp) => (
              <SelectItem key={psp.id} value={psp.id}>
                {psp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] glassmorphism">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="glassmorphism rounded-full h-10 w-10"
          onClick={fetchPayments}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/10">
              <TableHead className="text-foreground font-semibold">Store</TableHead>
              <TableHead className="text-foreground font-semibold">PSP</TableHead>
              <TableHead className="text-foreground font-semibold">Montant</TableHead>
              <TableHead className="text-foreground font-semibold">Statut</TableHead>
              <TableHead className="text-foreground font-semibold">Date</TableHead>
              <TableHead className="text-foreground font-semibold">Fallback</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  Aucun paiement trouvé
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const isExpanded = expandedId === payment.id
                return (
                  <Fragment key={payment.id}>
                    <TableRow
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.store?.name ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{payment.store?.domain ?? ""}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{payment.psp?.name ?? "-"}</span>
                          {payment.psp?.pspType && (
                            <Badge variant="secondary" className="text-xs">
                              {payment.psp.pspType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">
                          {formatAmount(payment.amount, payment.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge className={`text-xs ${STATUS_STYLES[payment.status] || ""}`}>
                            {payment.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {payment.isFallback && (
                          <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400">
                            Fallback
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${payment.id}-details`} className="bg-muted/10 border-b border-white/5">
                        <TableCell colSpan={7}>
                          <div className="py-4 px-6 flex items-start gap-16 text-sm">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <span className="text-muted-foreground text-sm">Runner</span>
                                <span className="block font-semibold text-sm mt-0.5">
                                  {stores.find(s => s.id === payment.store?.id)?.runner || "Non assigné"}
                                </span>
                              </div>
                            </div>
                            {payment.failureReason && (
                              <div className="min-w-0 flex-1">
                                <span className="text-muted-foreground text-sm">Raison échec</span>
                                <span className="block text-sm text-red-400 mt-0.5 break-words whitespace-normal">
                                  {payment.failureReason}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <span className="text-sm text-muted-foreground">
            {total} paiement{total > 1 ? "s" : ""} — Page {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="glassmorphism"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="glassmorphism"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
