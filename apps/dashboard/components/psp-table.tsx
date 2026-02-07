"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiClient, formatCurrencyNoDecimals, formatCurrency } from "@/lib/api-client"
import type { PSPWithStoreCount, PspList } from "@/lib/api-client"
import Image from "next/image"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    Dialog,
    DialogContent, DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    CreditCard,
    Plus,
    MoreHorizontal,
    Trash2,
    Eye,
    EyeOff,
    BarChart3,
    Gauge,
    KeyRound,
    RotateCcw,
    Archive,
    FolderPlus,
    Folder,
    CheckCircle2,
    XCircle
} from "lucide-react"

// Types de PSP disponibles
const PSP_TYPES = [
  { 
    value: "stripe", 
    label: "Stripe", 
    color: "bg-purple-500/20 text-purple-400",
    icon: "/stripe.png"
  },
  { 
    value: "checkout", 
    label: "Checkout.com", 
    color: "bg-blue-500/20 text-blue-400",
    icon: "/checkout-com.jpg",
    disabled: true
  },
]



// Fonction utilitaire pour extraire le message d'erreur
function getErrorMessage(err: unknown, defaultMessage: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as any;
    if (errorObj.message) {
      return errorObj.message;
    }
    if (errorObj.error) {
      return errorObj.error;
    }
  }
  return defaultMessage;
}

export function PSPTable() {
  const router = useRouter()
  const [psps, setPsps] = useState<PSPWithStoreCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCapacityDialogOpen, setIsCapacityDialogOpen] = useState(false)
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [forceDelete, setForceDelete] = useState(false)
  const [paymentCount, setPaymentCount] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showSecretKeys, setShowSecretKeys] = useState<Record<string, boolean>>({})
  const [showNewSecretKey, setShowNewSecretKey] = useState(false)
  const [selectedPSP, setSelectedPSP] = useState<PSPWithStoreCount | null>(null)
  const [pspLists, setPspLists] = useState<PspList[]>([])
  const [isAddToListDialogOpen, setIsAddToListDialogOpen] = useState(false)
  const [selectedListForAdd, setSelectedListForAdd] = useState<string | null>(null)
  const [newPSP, setNewPSP] = useState({
    name: "",
    type: "",
    publicKey: "",
    secretKey: ""
  })
  const [capacitySettings, setCapacitySettings] = useState({
    monthlyCapacity: "",
    dailyCapacity: ""
  })
  const [credentialsSettings, setCredentialsSettings] = useState({
    publicKey: "",
    secretKey: ""
  })

  // Charger les PSP et les listes depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const [pspsData, listsData] = await Promise.all([
          apiClient.psps.getAll(),
          apiClient.pspLists.getAll()
        ])

        // L'API retourne maintenant directement le nombre de stores connectés
        setPsps(pspsData)
        setPspLists(listsData)
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

  // Fonction pour obtenir les listes d'un PSP
  const getListsForPsp = (pspId: string): PspList[] => {
    return pspLists.filter(list => 
      list.items.some(item => item.pspId === pspId)
    )
  }

  // Fonction pour ajouter un PSP à une liste
  const handleAddPspToList = async () => {
    if (!selectedPSP || !selectedListForAdd) return

    try {
      await apiClient.pspLists.addPsps(selectedListForAdd, [selectedPSP.id])
      
      // Recharger les listes
      const updatedLists = await apiClient.pspLists.getAll()
      setPspLists(updatedLists)
      
      // Déclencher un événement pour rafraîchir les pages ouvertes
      window.dispatchEvent(new CustomEvent('psp-list-updated', { detail: { listId: selectedListForAdd } }))
      
      setIsAddToListDialogOpen(false)
      setSelectedListForAdd(null)
      setSelectedPSP(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur lors de l\'ajout du PSP à la liste')
      }
      console.error('Failed to add PSP to list:', err)
    }
  }

  const handleAddPSP = async () => {
    try {
      const pspData = {
        name: newPSP.name,
        pspType: newPSP.type,
        publicKey: newPSP.publicKey,
        secretKey: newPSP.secretKey,
      }
      
      const createdPSP = await apiClient.psps.create(pspData)
      
      setPsps([...psps, createdPSP])
      setNewPSP({ name: "", type: "", publicKey: "", secretKey: "" })
      setIsAddDialogOpen(false)
      setCurrentStep(1)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur lors de la création du PSP')
      }
      console.error('Failed to create PSP:', err)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 1 && newPSP.name && newPSP.type) {
      setCurrentStep(2)
    }
  }

  const handlePrevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
    }
  }

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false)
    setCurrentStep(1)
    setShowSecretKey(false)
    setNewPSP({ name: "", type: "", publicKey: "", secretKey: "" })
  }

  const toggleSecretKey = (pspId: string) => {
    setShowSecretKeys(prev => ({
      ...prev,
      [pspId]: !prev[pspId]
    }))
  }

  const maskSecretKey = (key: string) => {
    if (key.length <= 8) return key
    return key.substring(0, 8) + "..." + key.substring(key.length - 4)
  }

  const getPSPTypeInfo = (type: string) => {
    return PSP_TYPES.find(psp => psp.value === type) || PSP_TYPES[0]
  }

  const handleOpenCapacity = (psp: PSPWithStoreCount) => {
    setSelectedPSP(psp)
    setCapacitySettings({
      monthlyCapacity: "",
      dailyCapacity: ""
    })
    setIsCapacityDialogOpen(true)
  }

  const handleOpenCredentials = (psp: PSPWithStoreCount) => {
    setSelectedPSP(psp)
    setCredentialsSettings({
      publicKey: "",
      secretKey: ""
    })
    setIsCredentialsDialogOpen(true)
  }

  const handleSaveCapacity = async () => {
    if (!selectedPSP) return

    try {
      if (capacitySettings.monthlyCapacity || capacitySettings.dailyCapacity) {
        await apiClient.psps.update(selectedPSP.id, {
          monthlyCapacityEur: capacitySettings.monthlyCapacity ? parseInt(capacitySettings.monthlyCapacity) * 100 : undefined,
          dailyCapacityEur: capacitySettings.dailyCapacity ? parseInt(capacitySettings.dailyCapacity) * 100 : undefined,
        })
      }

      const updatedPsps = await apiClient.psps.getAll()
      setPsps(updatedPsps)

      setIsCapacityDialogOpen(false)
      setSelectedPSP(null)
      setCapacitySettings({
        monthlyCapacity: "",
        dailyCapacity: ""
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur lors de la mise à jour des capacités')
      }
      console.error('Failed to update PSP capacity:', err)
    }
  }

  const handleSaveCredentials = async () => {
    if (!selectedPSP) return

    try {
      if (credentialsSettings.publicKey || credentialsSettings.secretKey) {
        await apiClient.psps.updateCredentials(selectedPSP.id, {
          publicKey: credentialsSettings.publicKey || undefined,
          secretKey: credentialsSettings.secretKey || undefined,
        })
      }

      const updatedPsps = await apiClient.psps.getAll()
      setPsps(updatedPsps)

      setIsCredentialsDialogOpen(false)
      setSelectedPSP(null)
      setShowNewSecretKey(false)
      setCredentialsSettings({
        publicKey: "",
        secretKey: ""
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur lors de la mise à jour des credentials')
      }
      console.error('Failed to update PSP credentials:', err)
    }
  }

  const handleOpenDelete = async (psp: PSPWithStoreCount) => {
    setSelectedPSP(psp)
    setDeleteConfirmText("")
    setForceDelete(false)
    setIsDeleteDialogOpen(true)
    
    // Récupérer le nombre de paiements liés
    try {
      const result = await apiClient.psps.getPaymentCount(psp.id)
      setPaymentCount(result.count)
    } catch (err) {
      console.error('Failed to get payment count:', err)
      setPaymentCount(null)
    }
  }

  const handleSoftDelete = async () => {
    if (selectedPSP) {
      try {
        await apiClient.psps.delete(selectedPSP.id)
        // Mettre à jour le PSP comme archivé au lieu de le supprimer de la liste
        setPsps(psps.map(psp =>
          psp.id === selectedPSP.id
            ? { ...psp, isActive: false, deletedAt: new Date().toISOString() }
            : psp
        ))
        toast.success(`PSP "${selectedPSP.name}" archivé avec succès`)
        setIsDeleteDialogOpen(false)
        setSelectedPSP(null)
        setDeleteConfirmText("")
        setError(null)
      } catch (err) {
        const errorMessage = getErrorMessage(err, 'Erreur lors de l\'archivage du PSP');
        setError(errorMessage)
        toast.error(errorMessage)
        console.error('Failed to archive PSP:', err)
      }
    }
  }

  const handleHardDelete = async () => {
    if (selectedPSP && deleteConfirmText === selectedPSP.name) {
      try {
        await apiClient.psps.hardDelete(selectedPSP.id, forceDelete)
        setPsps(psps.filter(psp => psp.id !== selectedPSP.id))
        toast.success(`PSP "${selectedPSP.name}" supprimé définitivement`)
        setIsDeleteDialogOpen(false)
        setSelectedPSP(null)
        setDeleteConfirmText("")
        setForceDelete(false)
        setPaymentCount(null)
        setError(null)
      } catch (err) {
        const errorMessage = getErrorMessage(err, 'Erreur lors de la suppression du PSP');
        setError(errorMessage)
        toast.error(errorMessage)
        console.error('Failed to delete PSP:', err)
      }
    }
  }

  const handleRestore = async (psp: PSPWithStoreCount) => {
    try {
      await apiClient.psps.restore(psp.id)
      setPsps(psps.map(p =>
        p.id === psp.id
          ? { ...p, isActive: true, deletedAt: null }
          : p
      ))
      toast.success(`PSP "${psp.name}" restauré avec succès`)
      setError(null)
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Erreur lors de la restauration du PSP');
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Failed to restore PSP:', err)
    }
  }

  const handleOpenAnalytics = (psp: PSPWithStoreCount) => {
    // Redirection vers la page analytics du PSP
    router.push(`/analytics/psp/${psp.id}`);
  }

  const handleToggleSelfieVerification = async (psp: PSPWithStoreCount) => {
    try {
      await apiClient.psps.update(psp.id, {
        selfieVerified: !psp.selfieVerified
      })
      
      const updatedPsps = await apiClient.psps.getAll()
      setPsps(updatedPsps)
      
      toast.success(
        psp.selfieVerified 
          ? `Vérification Selfie désactivée pour "${psp.name}"`
          : `Vérification Selfie activée pour "${psp.name}"`
      )
      setError(null)
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Erreur lors de la mise à jour de la vérification Selfie');
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Failed to update selfie verification:', err)
    }
  }

  // Affichage du loading
  if (loading) {
    return (
      <Card className="glow-subtle">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg font-semibold">Fournisseurs de Paiement (PSP)</CardTitle>
          </div>
          <div className="h-10 w-32 bg-muted/30 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden">
            {/* Table Header Skeleton */}
            <div className="border-b border-muted/20 p-4">
              <div className="grid grid-cols-6 gap-4">
                <div className="h-4 w-12 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-muted/30 rounded animate-pulse"></div>
              </div>
            </div>
            
            {/* Table Rows Skeleton */}
            <div className="space-y-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border-b border-muted/10 p-4 animate-pulse">
                  <div className="grid grid-cols-6 gap-4 items-center">
                    {/* PSP info */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted/30"></div>
                      <div>
                        <div className="h-4 w-24 bg-muted/30 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-muted/30 rounded"></div>
                      </div>
                    </div>
                    
                    {/* Type */}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-muted/30 rounded"></div>
                      <div className="h-4 w-16 bg-muted/30 rounded"></div>
                    </div>
                    
                    {/* Capacité Mensuelle */}
                    <div className="h-4 w-20 bg-muted/30 rounded"></div>
                    
                    {/* Capacité Journalière */}
                    <div className="h-4 w-20 bg-muted/30 rounded"></div>
                    
                    {/* Boutiques */}
                    <div className="h-6 w-20 bg-muted/30 rounded-full"></div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-8 bg-muted/30 rounded"></div>
                      <div className="w-8 h-8 bg-muted/30 rounded"></div>
                      <div className="w-8 h-8 bg-muted/30 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Affichage des erreurs
  if (error) {
    return (
      <Card className="glow-subtle">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg font-semibold">Fournisseurs de Paiement (PSP)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
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
    )
  }

  // Calculer le cap total et l'usage des PSPs actifs (non archivés)
  // Les deux sont en CENTIMES (dailyCapacityEur est mal nommé)
  const activePsps = psps.filter(psp => psp.isActive)
  const totalCap = activePsps.reduce((sum, psp) => sum + (psp.dailyCapacityEur || 0), 0)
  const totalUsage = activePsps.reduce((sum, psp) => sum + (psp.usageBusinessDay || 0), 0)
  const usagePercent = totalCap > 0 ? Math.round(totalUsage / totalCap * 100) : 0

  return (
    <div className="space-y-4">
      {/* Daily Cap Total */}
      {totalCap > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl glassmorphism border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20">
              <Gauge className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Cap Daily Total</div>
              <div className="text-xs text-muted-foreground">{activePsps.length} PSP actifs (depuis 6h)</div>
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
      )}

    <Card className="glow-subtle">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold">Fournisseurs de Paiement (PSP)</CardTitle>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          if (open) {
            setIsAddDialogOpen(true)
          } else {
            handleCloseDialog()
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ajouter un PSP</span>
              <span className="sm:hidden">Ajouter</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Ajouter un nouveau PSP</DialogTitle>
              
              {/* Stepper */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    1
                  </div>
                  <span className={`text-sm ${currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Informations
                  </span>
                </div>
                <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    2
                  </div>
                  <span className={`text-sm ${currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Clés API
                  </span>
                </div>
              </div>
            </DialogHeader>
            
            {currentStep === 1 ? (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="psp-name">Nom du PSP</Label>
                  <Input
                    id="psp-name"
                    value={newPSP.name}
                    onChange={(e) => setNewPSP(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Mon PSP Stripe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Type de PSP</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PSP_TYPES.map((type) => (
                      <div
                        key={type.value}
                        onClick={() => !type.disabled && setNewPSP(prev => ({ ...prev, type: type.value }))}
                        className={`relative rounded-xl border-2 p-4 transition-all ${
                          type.disabled
                            ? 'border-muted/50 bg-muted/10 cursor-not-allowed opacity-60'
                            : newPSP.type === type.value
                            ? 'border-primary bg-primary/5 cursor-pointer'
                            : 'border-muted hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8">
                            <Image
                              src={type.icon}
                              alt={type.label}
                              width={32}
                              height={32}
                              className={`object-contain ${type.value === 'checkout' ? 'rounded-sm' : ''}`}
                            />
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-sm">{type.label}</div>
                          </div>
                        </div>
                        {type.disabled && (
                          <div className="absolute -top-2 -right-2">
                            <Badge variant="secondary" className="text-xs px-2 py-1 bg-muted text-muted-foreground">
                              À venir
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="public-key">Clé Publique</Label>
                  <Input
                    id="public-key"
                    value={newPSP.publicKey}
                    onChange={(e) => setNewPSP(prev => ({ ...prev, publicKey: e.target.value }))}
                    placeholder="pk_live_..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="secret-key">Clé Secrète</Label>
                  <div className="relative">
                    <Input
                      id="secret-key"
                      type={showSecretKey ? "text" : "password"}
                      value={newPSP.secretKey}
                      onChange={(e) => setNewPSP(prev => ({ ...prev, secretKey: e.target.value }))}
                      placeholder="sk_live_..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                    >
                      {showSecretKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={currentStep === 1 ? handleCloseDialog : handlePrevStep}
              >
                {currentStep === 1 ? "Annuler" : "Précédent"}
              </Button>
              {currentStep === 1 ? (
                <Button 
                  onClick={handleNextStep}
                  disabled={!newPSP.name || !newPSP.type}
                >
                  Suivant
                </Button>
              ) : (
                <Button 
                  onClick={handleAddPSP}
                  disabled={!newPSP.publicKey || !newPSP.secretKey}
                >
                  Ajouter le PSP
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal des capacités */}
        <Dialog open={isCapacityDialogOpen} onOpenChange={setIsCapacityDialogOpen}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Capacités du PSP</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Modifier les capacités pour {selectedPSP?.name}
              </p>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="monthly-capacity">Capacité mensuelle (€)</Label>
                <Input
                  id="monthly-capacity"
                  type="number"
                  value={capacitySettings.monthlyCapacity}
                  onChange={(e) => setCapacitySettings(prev => ({ ...prev, monthlyCapacity: e.target.value }))}
                  placeholder={selectedPSP?.monthlyCapacityEur ? (selectedPSP.monthlyCapacityEur / 100).toString() : "100000"}
                />
                {selectedPSP?.monthlyCapacityEur && (
                  <p className="text-xs text-muted-foreground">
                    Actuel : {(selectedPSP.monthlyCapacityEur / 100).toLocaleString('fr-FR')} €
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily-capacity">Capacité journalière (€)</Label>
                <Input
                  id="daily-capacity"
                  type="number"
                  value={capacitySettings.dailyCapacity}
                  onChange={(e) => setCapacitySettings(prev => ({ ...prev, dailyCapacity: e.target.value }))}
                  placeholder={selectedPSP?.dailyCapacityEur ? (selectedPSP.dailyCapacityEur / 100).toString() : "5000"}
                />
                {selectedPSP?.dailyCapacityEur && (
                  <p className="text-xs text-muted-foreground">
                    Actuel : {(selectedPSP.dailyCapacityEur / 100).toLocaleString('fr-FR')} €
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Laissez vide pour ne pas modifier une capacité.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCapacityDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveCapacity}>
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal des credentials */}
        <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Clés API du PSP</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Modifier les clés API pour {selectedPSP?.name}
              </p>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-public-key">Nouvelle clé publique</Label>
                <Input
                  id="new-public-key"
                  value={credentialsSettings.publicKey}
                  onChange={(e) => setCredentialsSettings(prev => ({ ...prev, publicKey: e.target.value }))}
                  placeholder="pk_live_..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-secret-key">Nouvelle clé secrète</Label>
                <div className="relative">
                  <Input
                    id="new-secret-key"
                    type={showNewSecretKey ? "text" : "password"}
                    value={credentialsSettings.secretKey}
                    onChange={(e) => setCredentialsSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                    placeholder="sk_live_..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewSecretKey(!showNewSecretKey)}
                  >
                    {showNewSecretKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les nouvelles clés remplaceront les anciennes. Laissez vide pour ne pas modifier.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCredentialsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveCredentials}>
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmation de suppression */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setDeleteConfirmText("")
        }}>
          <DialogContent className="border-primary/20 sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Gérer le PSP &quot;{selectedPSP?.name}&quot;</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Choisissez une action pour ce PSP.
              </p>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Option 1: Archiver (soft delete) */}
              <div className="p-4 bg-muted/50 border rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">Archiver</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Le PSP sera désactivé mais conservé. Vous pourrez le restaurer plus tard.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSoftDelete}
                  >
                    Archiver
                  </Button>
                </div>
              </div>

              {/* Séparateur */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Option 2: Supprimer définitivement (hard delete) */}
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-destructive">Supprimer définitivement</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cette action est irréversible. Le PSP sera complètement supprimé.
                    </p>
                    {paymentCount !== null && paymentCount > 0 && (
                      <div className="mt-3 p-3 bg-destructive/20 border border-destructive/30 rounded-md">
                        <p className="text-sm font-medium text-destructive mb-2">
                          ⚠️ Attention : {paymentCount} paiement{paymentCount > 1 ? 's sont' : ' est'} lié{paymentCount > 1 ? 's' : ''} à ce PSP
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          La suppression supprimera le PSP mais les paiements garderont une référence orpheline. 
                          Cette action peut affecter vos statistiques et rapports.
                        </p>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="force-delete"
                            checked={forceDelete}
                            onCheckedChange={(checked) => setForceDelete(checked === true)}
                            className="border-destructive"
                          />
                          <Label 
                            htmlFor="force-delete" 
                            className="text-sm font-medium cursor-pointer text-destructive"
                          >
                            Je comprends les risques et souhaite forcer la suppression
                          </Label>
                        </div>
                      </div>
                    )}
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Interruption des paiements pour {selectedPSP?.connectedStores} boutique{(selectedPSP?.connectedStores || 0) > 1 ? 's' : ''}</li>
                      <li>• Dissociation de l&apos;historique des paiements</li>
                      {paymentCount !== null && paymentCount > 0 && (
                        <li>• {paymentCount} paiement{paymentCount > 1 ? 's' : ''} avec référence orpheline</li>
                      )}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="text-sm">
                      Tapez <span className="font-semibold text-foreground">{selectedPSP?.name}</span> pour confirmer
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="delete-confirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={selectedPSP?.name}
                        className="border-destructive/30 focus:border-destructive"
                      />
                      <Button
                        variant="destructive"
                        onClick={handleHardDelete}
                        disabled={
                          deleteConfirmText !== selectedPSP?.name || 
                          (paymentCount !== null && paymentCount > 0 && !forceDelete)
                        }
                      >
                        Supprimer
                      </Button>
                    </div>
                    {paymentCount !== null && paymentCount > 0 && !forceDelete && (
                      <p className="text-xs text-muted-foreground">
                        Cochez la case ci-dessus pour forcer la suppression malgré les paiements liés
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedPSP(null)
                setDeleteConfirmText("")
                setForceDelete(false)
                setPaymentCount(null)
                setError(null)
              }}>
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pour ajouter un PSP à une liste */}
        <Dialog open={isAddToListDialogOpen} onOpenChange={setIsAddToListDialogOpen}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Ajouter "{selectedPSP?.name}" à une liste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choisir une liste</Label>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {pspLists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune liste disponible</p>
                  ) : (
                    pspLists.map(list => {
                      const isPspInList = list.items.some(item => item.pspId === selectedPSP?.id)
                      return (
                        <div
                          key={list.id}
                          onClick={() => !isPspInList && setSelectedListForAdd(list.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedListForAdd === list.id
                              ? 'border-primary bg-primary/10'
                              : isPspInList
                              ? 'border-muted bg-muted/50 cursor-not-allowed opacity-50'
                              : 'border-muted hover:border-primary/50 hover:bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-primary" />
                              <div>
                                <p className="font-medium text-sm">{list.name}</p>
                                {list.description && (
                                  <p className="text-xs text-muted-foreground">{list.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {list.items.length} PSP dans la liste
                                </p>
                              </div>
                            </div>
                            {isPspInList && (
                              <Badge variant="secondary" className="text-xs">
                                Déjà dans la liste
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddToListDialogOpen(false)
                setSelectedListForAdd(null)
                setSelectedPSP(null)
              }}>
                Annuler
              </Button>
              <Button
                onClick={handleAddPspToList}
                disabled={!selectedListForAdd}
              >
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardHeader>
      
      <CardContent>
        <div className="rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10">
                <TableHead className="text-foreground font-semibold">PSP</TableHead>
                <TableHead className="text-foreground font-semibold">Type</TableHead>
                <TableHead className="text-foreground font-semibold">Status</TableHead>
                <TableHead className="text-foreground font-semibold">Usage 30j / Cap. (€)</TableHead>
                <TableHead className="text-foreground font-semibold">Usage 24h / Cap. (€)</TableHead>
                <TableHead className="text-foreground font-semibold">Boutiques</TableHead>
                <TableHead className="text-foreground font-semibold">Listes</TableHead>
                <TableHead className="text-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {psps.map((psp) => {
                const typeInfo = getPSPTypeInfo(psp.pspType)
                const isArchived = !!psp.deletedAt
                return (
                  <TableRow key={psp.id} className={`border-b border-white/5 hover:bg-white/5 ${isArchived ? 'opacity-50' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isArchived ? 'bg-muted' : 'bg-primary/20'}`}>
                          {isArchived ? (
                            <Archive className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{psp.name}</div>
                          {psp.selfieVerified && !isArchived && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Vérification Selfie effectuée</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isArchived && (
                            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                              Archivé
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-2">
                        <Image
                          src={typeInfo.icon}
                          alt={typeInfo.label}
                          width={16}
                          height={16}
                          className={`flex-shrink-0 ${psp.pspType === 'checkout' ? 'rounded-sm' : ''}`}
                        />
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {psp.pspType === 'stripe' && !isArchived ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={psp.stripeChargesEnabled !== false ? 'default' : 'destructive'}
                                className={`text-xs ${psp.stripeChargesEnabled !== false ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : ''}`}
                              >
                                {psp.stripeChargesEnabled !== false ? 'Charges' : 'Charges off'}
                              </Badge>
                              <Badge
                                variant={psp.stripePayoutsEnabled !== false ? 'default' : 'destructive'}
                                className={`text-xs ${psp.stripePayoutsEnabled !== false ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : ''}`}
                              >
                                {psp.stripePayoutsEnabled !== false ? 'Payouts' : 'Payouts off'}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className={psp.stripeChargesEnabled !== false ? 'text-green-500' : 'text-destructive'}>
                                Charges: {psp.stripeChargesEnabled !== false ? 'Enabled' : 'Disabled'}
                              </p>
                              <p className={psp.stripePayoutsEnabled !== false ? 'text-green-500' : 'text-destructive'}>
                                Payouts: {psp.stripePayoutsEnabled !== false ? 'Enabled' : 'Disabled'}
                              </p>
                              {psp.lastStripeCheck && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Vérifié: {new Date(psp.lastStripeCheck).toLocaleString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {psp.monthlyCapacityEur ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono cursor-help">
                                {formatCurrencyNoDecimals(psp.usage30d ?? psp.currentMonthUsage)} / {formatCurrencyNoDecimals(psp.monthlyCapacityEur)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Usage sur les 30 derniers jours (glissant)</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">Non définie</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {psp.dailyCapacityEur ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono cursor-help">
                                {formatCurrencyNoDecimals(psp.usageBusinessDay ?? psp.currentDayUsage)} / {formatCurrencyNoDecimals(psp.dailyCapacityEur)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Usage depuis 6h Paris (jour ouvrable)</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">Non définie</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={(psp.connectedStores || 0) > 0 ? "default" : "secondary"}
                      >
                        {psp.connectedStores || 0} boutique{(psp.connectedStores || 0) > 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getListsForPsp(psp.id).length === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        ) : (
                          getListsForPsp(psp.id).slice(0, 2).map(list => (
                            <Badge key={list.id} variant="outline" className="text-xs">
                              <Folder className="h-3 w-3 mr-1" />
                              {list.name}
                            </Badge>
                          ))
                        )}
                        {getListsForPsp(psp.id).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{getListsForPsp(psp.id).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Icône Analytics */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-purple-500/10 hover:text-purple-500"
                              onClick={() => handleOpenAnalytics(psp)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Voir les analytics</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Icône Capacités */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleOpenCapacity(psp)}
                            >
                              <Gauge className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Capacités</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Icône Clés API */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleOpenCredentials(psp)}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Clés API</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Icône More (Supprimer) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-muted"
                              title="Plus d'options"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!psp.deletedAt && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPSP(psp)
                                    setIsAddToListDialogOpen(true)
                                  }}
                                >
                                  <FolderPlus className="h-4 w-4 mr-2" />
                                  Ajouter à une liste
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleSelfieVerification(psp)}
                                >
                                  {psp.selfieVerified ? (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Désactiver vérification Selfie
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Activer vérification Selfie
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                            {psp.deletedAt ? (
                              <DropdownMenuItem
                                onClick={() => handleRestore(psp)}
                                className="text-primary focus:text-primary"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restaurer
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() => handleOpenDelete(psp)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {psp.deletedAt ? 'Supprimer définitivement' : 'Supprimer'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
