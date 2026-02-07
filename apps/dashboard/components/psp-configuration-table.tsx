"use client"

import * as React from "react"
import { apiClient } from "@/lib/api-client"
import type { PSPWithStoreCount, PspList } from "@/lib/api-client"
import { toast } from "sonner"
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from "@tanstack/react-table"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export type PSP = {
  id: string
  name: string
  displayName?: string
  logo: string
  type: "configured" | "available"
  successRate?: number
  avgProcessingTime?: string
  volume24h?: string
}

interface PSPConfigurationTableProps {
  storeId: string
  configuredPspIds: string[] // Maintenant ce sont les IDs de PSP globaux
  onAddPsp: (pspIds: string[]) => void
  onRemovePsp: (pspId: string) => void
  isSaving?: boolean
  onListApplied?: () => void // Callback appelé après l'application d'une liste
}

export const columns: ColumnDef<PSP>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => {
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select PSP"
        />
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "displayName",
    header: "PSP",
    cell: ({ row }) => {
      const psp = row.original
      return (
        <div className="flex items-center gap-3">
          <Image
            src={psp.logo}
            alt={psp.displayName || psp.name}
            width={24}
            height={24}
            className="rounded"
          />
          <div>
            <div className="font-medium">
              {psp.displayName}
            </div>
            <div className="text-xs text-muted-foreground">
              {psp.name}
            </div>
          </div>
        </div>
      )
    },
  }
]

export function PSPConfigurationTable({ storeId, configuredPspIds, onAddPsp, onRemovePsp, isSaving = false, onListApplied }: PSPConfigurationTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [allPsps, setAllPsps] = React.useState<PSPWithStoreCount[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pspLists, setPspLists] = React.useState<PspList[]>([])
  const [selectedListId, setSelectedListId] = React.useState<string>("")

  // Charger tous les PSP disponibles et les listes
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [psps, lists] = await Promise.all([
          apiClient.psps.getAll(),
          apiClient.pspLists.getAll()
        ])
        setAllPsps(psps)
        setPspLists(lists)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])
  
  // Filtrer les PSP actifs (non archivés)
  const activePsps = React.useMemo(() => {
    return allPsps.filter(psp => !psp.deletedAt && psp.isActive)
  }, [allPsps])

  // Fonction pour appliquer une liste
  const handleApplyList = React.useCallback(async () => {
    if (!selectedListId) return
    
    const selectedList = pspLists.find(list => list.id === selectedListId)
    if (!selectedList) return

    try {
      // Utiliser linkPspListToStore pour lier la liste à la boutique
      // Cela définit le pspListId dans la boutique et active la synchronisation
      const result = await apiClient.storePsp.linkList(storeId, selectedListId)
      
      // Récupérer les IDs des PSP actifs de la liste pour mettre à jour la sélection
      const pspIds = selectedList.items
        .filter(item => item.psp.isActive && !item.psp.deletedAt)
        .map(item => item.pspId)

      if (pspIds.length > 0) {
        // Sélectionner tous les PSP de la liste dans la table
        const newSelection: Record<string, boolean> = {}
        activePsps.forEach(psp => {
          if (pspIds.includes(psp.id)) {
            newSelection[psp.id] = true
          }
        })
        setRowSelection(newSelection)
      }
      
      toast.success(`Liste "${result.listName}" appliquée à la boutique. ${result.linkedCount} PSP lié(s).`)
      
      // Notifier le parent pour rafraîchir les données
      if (onListApplied) {
        onListApplied()
      }
    } catch (error) {
      console.error('Erreur lors de l\'application de la liste:', error)
      toast.error('Erreur lors de l\'application de la liste')
    }
  }, [selectedListId, pspLists, activePsps, storeId, onListApplied])

  // Convertir les PSP en format pour la table
  const data = React.useMemo((): PSP[] => {
    if (loading) return []

    const tableData = activePsps.map(psp => {
      const isConfigured = configuredPspIds.includes(psp.id)

      return {
        id: psp.id,
        name: psp.name,
        displayName: psp.name,
        logo: `/${psp.pspType}.png`,
        type: isConfigured ? "configured" as const : "available" as const
      }
    })

    return tableData
  }, [activePsps, configuredPspIds, loading])

  // Gérer la sélection avec les PSP configurés
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})

  // Mettre à jour la sélection quand configuredPspIds change
  React.useEffect(() => {
    const selection = activePsps.reduce((acc, psp) => {
      if (configuredPspIds.includes(psp.id)) {
        acc[psp.id] = true
      }
      return acc
    }, {} as Record<string, boolean>)
    setRowSelection(selection)
  }, [configuredPspIds, activePsps])

  // Réinitialiser la sélection quand les données changent
  React.useEffect(() => {
    if (!loading && activePsps.length > 0) {
      const selection = activePsps.reduce((acc, psp) => {
        if (configuredPspIds.includes(psp.id)) {
          acc[psp.id] = true
        }
        return acc
      }, {} as Record<string, boolean>)
      setRowSelection(selection)
    }
  }, [loading, activePsps, configuredPspIds])

  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id, // Utiliser l'ID du PSP comme clé de ligne
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row, columnId, filterValue) => {
      const psp = row.original
      const searchValue = filterValue.toLowerCase()
      return (
        psp.displayName?.toLowerCase().includes(searchValue) ||
        psp.name.toLowerCase().includes(searchValue)
      )
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  })

  // Récupérer tous les PSP sélectionnés
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedPsps = selectedRows.map(row => row.original.id)

  if (loading) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-64 bg-muted/30 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-muted/30 rounded animate-pulse"></div>
        </div>
        <div className="h-64 bg-muted/20 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedListId} onValueChange={setSelectedListId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Sélectionner une liste" />
          </SelectTrigger>
          <SelectContent>
            {pspLists.length === 0 ? (
              <SelectItem value="none" disabled>Aucune liste disponible</SelectItem>
            ) : (
              pspLists.map(list => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} ({list.items.length} PSP)
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={handleApplyList}
          disabled={!selectedListId || isSaving}
          variant="outline"
        >
          Appliquer la liste
        </Button>
        <div className="flex-1" />
        <Input
          placeholder="Filtrer les PSP..."
          value={globalFilter}
          onChange={(event) =>
            setGlobalFilter(event.target.value)
          }
          className="max-w-sm"
        />
        <Button
          onClick={() => {
            onAddPsp(selectedPsps)
          }}
          disabled={selectedPsps.length === 0 || isSaving}
        >
          {isSaving ? 'Synchronisation...' : `Synchroniser (${selectedPsps.length})`}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => row.toggleSelected()}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucun PSP trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-muted-foreground text-sm">
          {table.getFilteredSelectedRowModel().rows.length} sur{" "}
          {table.getFilteredRowModel().rows.length} PSP sélectionné{table.getFilteredSelectedRowModel().rows.length !== 1 ? 's' : ''}.
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}
