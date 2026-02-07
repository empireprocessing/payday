"use client"

import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api-client"
import type { PspList, PSPWithStoreCount } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Folder,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  Store as StoreIcon,
  Wallet
} from "lucide-react"
import { formatCurrencyNoDecimals } from "@/lib/api-client"
import { toast } from "sonner"
import Image from "next/image"

interface PspListManagerProps {
  onListSelect?: (listId: string) => void
  showSelectButton?: boolean
}

export function PspListManager({ onListSelect, showSelectButton = false }: PspListManagerProps) {
  const [lists, setLists] = useState<PspList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedList, setSelectedList] = useState<PspList | null>(null)
  const [allPsps, setAllPsps] = useState<PSPWithStoreCount[]>([])
  const [newList, setNewList] = useState({
    name: "",
    selectedPspIds: [] as string[]
  })

  // Charger les listes et tous les PSP
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const [listsData, pspsData] = await Promise.all([
          apiClient.pspLists.getAll(),
          apiClient.psps.getAll()
        ])
        
        setLists(listsData)
        setAllPsps(pspsData.filter(psp => !psp.deletedAt && psp.isActive))
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Une erreur est survenue')
        }
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCreateList = async () => {
    if (!newList.name.trim()) {
      toast.error('Le nom de la liste est requis')
      return
    }

    if (newList.selectedPspIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un PSP')
      return
    }

    try {
      const createdList = await apiClient.pspLists.create({
        name: newList.name,
        pspIds: newList.selectedPspIds
      })

      setLists([...lists, createdList])
      setNewList({ name: "", selectedPspIds: [] })
      setIsCreateDialogOpen(false)
      toast.success('Liste créée avec succès')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
        toast.error(err.message)
      } else {
        setError('Erreur lors de la création de la liste')
        toast.error('Erreur lors de la création de la liste')
      }
      console.error('Failed to create list:', err)
    }
  }

  const handleEditList = async () => {
    if (!selectedList || !newList.name.trim()) {
      toast.error('Le nom de la liste est requis')
      return
    }

    if (newList.selectedPspIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un PSP')
      return
    }

    try {
      const updatedList = await apiClient.pspLists.update(selectedList.id, {
        name: newList.name,
        pspIds: newList.selectedPspIds
      })

      setLists(lists.map(list => list.id === updatedList.id ? updatedList : list))
      setNewList({ name: "", selectedPspIds: [] })
      setIsEditDialogOpen(false)
      setSelectedList(null)
      toast.success('Liste mise à jour avec succès. Les boutiques utilisant cette liste ont été synchronisées.')
      
      // Déclencher un événement pour rafraîchir les pages ouvertes
      window.dispatchEvent(new CustomEvent('psp-list-updated', { detail: { listId: updatedList.id } }))
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
        toast.error(err.message)
      } else {
        setError('Erreur lors de la mise à jour de la liste')
        toast.error('Erreur lors de la mise à jour de la liste')
      }
      console.error('Failed to update list:', err)
    }
  }

  const handleDeleteList = async () => {
    if (!selectedList) return

    try {
      await apiClient.pspLists.delete(selectedList.id)
      setLists(lists.filter(list => list.id !== selectedList.id))
      setIsDeleteDialogOpen(false)
      setSelectedList(null)
      toast.success('Liste supprimée avec succès')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
        toast.error(err.message)
      } else {
        setError('Erreur lors de la suppression de la liste')
        toast.error('Erreur lors de la suppression de la liste')
      }
      console.error('Failed to delete list:', err)
    }
  }

  const handleOpenEdit = (list: PspList) => {
    setSelectedList(list)
    setNewList({
      name: list.name,
      selectedPspIds: list.items.map(item => item.pspId)
    })
    setIsEditDialogOpen(true)
  }

  const handleOpenDelete = (list: PspList) => {
    setSelectedList(list)
    setIsDeleteDialogOpen(true)
  }

  const togglePspSelection = (pspId: string) => {
    setNewList(prev => ({
      ...prev,
      selectedPspIds: prev.selectedPspIds.includes(pspId)
        ? prev.selectedPspIds.filter(id => id !== pspId)
        : [...prev.selectedPspIds, pspId]
    }))
  }

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setNewList({ name: "", selectedPspIds: [] })
  }

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false)
    setSelectedList(null)
    setNewList({ name: "", selectedPspIds: [] })
  }

  // Calculer le cap total d'une liste (somme des caps daily de tous les PSPs)
  const calculateListTotalCap = (list: PspList): number => {
    return list.items.reduce((total, item) => {
      const psp = allPsps.find(p => p.id === item.pspId)
      return total + (psp?.dailyCapacityEur || 0)
    }, 0)
  }

  if (loading) {
    return (
      <Card className="glow-subtle">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="glow-subtle">
        <CardContent className="p-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium">Erreur de chargement</p>
            <p className="text-muted-foreground mt-2">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Listes de PSP</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Créer une liste
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une liste de PSP</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name">Nom de la liste *</Label>
                <Input
                  id="list-name"
                  value={newList.name}
                  onChange={(e) => setNewList(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Liste Stripe Production"
                />
              </div>
              <div>
                <Label>PSP disponibles</Label>
                <div className="mt-2 border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {allPsps.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucun PSP disponible</p>
                  ) : (
                    allPsps.map(psp => (
                      <div key={psp.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                        <Checkbox
                          checked={newList.selectedPspIds.includes(psp.id)}
                          onCheckedChange={() => togglePspSelection(psp.id)}
                        />
                        <Image
                          src={`/${psp.pspType}.png`}
                          alt={psp.name}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                        <span className="flex-1 text-sm">{psp.name}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {newList.selectedPspIds.length} PSP sélectionné(s)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseCreateDialog}>
                Annuler
              </Button>
              <Button onClick={handleCreateList}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <Card className="glow-subtle">
          <CardContent className="p-12 text-center">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune liste de PSP créée</p>
            <p className="text-sm text-muted-foreground mt-2">
              Créez votre première liste pour organiser vos PSP
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(list => (
            <Card key={list.id} className="glow-subtle hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {list.name}
                      </CardTitle>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {showSelectButton && onListSelect && (
                        <>
                          <DropdownMenuItem onClick={() => onListSelect(list.id)}>
                            Sélectionner
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => handleOpenEdit(list)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenDelete(list)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">PSP dans la liste</span>
                    <Badge variant="secondary">{list.items.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      Cap total
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="font-mono cursor-help">
                          {formatCurrencyNoDecimals(calculateListTotalCap(list))}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Plafond 24h total (€)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.items.slice(0, 3).map(item => (
                      <div key={item.id} className="flex items-center gap-1.5">
                        <Image
                          src={`/${item.psp.pspType}.png`}
                          alt={item.psp.name}
                          width={16}
                          height={16}
                          className="rounded"
                        />
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                          {item.psp.name}
                        </span>
                      </div>
                    ))}
                    {list.items.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{list.items.length - 3} autres
                      </span>
                    )}
                  </div>
                  
                  {/* Afficher les boutiques qui utilisent cette liste */}
                  {list.stores && list.stores.length > 0 && (
                    <div className="pt-2 border-t border-muted/20">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Boutiques utilisant cette liste</span>
                        <Badge variant="outline">{list.stores.length}</Badge>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {list.stores.slice(0, 3).map(store => (
                          <div key={store.id} className="flex items-center gap-2 text-xs">
                            <StoreIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground truncate" title={store.domain}>
                              {store.name}
                            </span>
                          </div>
                        ))}
                        {list.stores.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{list.stores.length - 3} autre(s) boutique(s)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {(!list.stores || list.stores.length === 0) && (
                    <div className="pt-2 border-t border-muted/20">
                      <span className="text-xs text-muted-foreground">Aucune boutique n'utilise cette liste</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la liste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-list-name">Nom de la liste *</Label>
              <Input
                id="edit-list-name"
                value={newList.name}
                onChange={(e) => setNewList(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Liste Stripe Production"
              />
            </div>
            <div>
              <Label>PSP dans la liste ({newList.selectedPspIds.length})</Label>
              <div className="mt-2 border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                {allPsps.map(psp => (
                  <div key={psp.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox
                      checked={newList.selectedPspIds.includes(psp.id)}
                      onCheckedChange={() => togglePspSelection(psp.id)}
                    />
                    <Image
                      src={`/${psp.pspType}.png`}
                      alt={psp.name}
                      width={24}
                      height={24}
                      className="rounded"
                    />
                    <span className="flex-1 text-sm">{psp.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Annuler
            </Button>
            <Button onClick={handleEditList}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la liste</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer la liste "{selectedList?.name}" ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteList}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
