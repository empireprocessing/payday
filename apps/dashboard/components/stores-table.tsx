"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient, useApiError, StorePlatform, formatCurrencyNoDecimals } from "@/lib/api-client"
import type { Store, UpdateStoreData } from "@/lib/api-client"
import Image from "next/image"
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  Store as StoreIcon,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Pencil,
  CreditCard,
  Globe,
  BarChart3,
  Loader2,
  Plug,
  Facebook,
  Music,
  Truck,
  Shield,
  Languages,
  X,
  Check
} from "lucide-react"
import { toast } from "sonner"
import { DnsRecordsTable } from "./dns-records-table"

// Plateformes e-commerce disponibles
const PLATFORM_TYPES: { value: StorePlatform; label: string; description: string; icon: string; badge?: string; disabled?: boolean }[] = [
  {
    value: StorePlatform.WOOCOMMERCE,
    label: "WooCommerce",
    description: "WordPress + WooCommerce",
    icon: "/woocommerce.svg",
    badge: "Recommandé"
  },
  {
    value: StorePlatform.SHOPIFY,
    label: "Shopify",
    description: "Plateforme e-commerce",
    icon: "/shopify.svg"
  },
  // {
  //   value: StorePlatform.PRESTASHOP,
  //   label: "PrestaShop",
  //   description: "Solution open-source",
  //   icon: "/prestashop.svg",
  //   disabled: true
  // },
  // {
  //   value: StorePlatform.MAGENTO,
  //   label: "Magento",
  //   description: "Enterprise e-commerce",
  //   icon: "/magento.svg",
  //   disabled: true
  // },
]

// Validation de format de domaine
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i
function isValidDomain(domain: string): boolean {
  if (!domain) return true // Vide = pas encore rempli, pas d'erreur
  return DOMAIN_REGEX.test(domain)
}

// Interface pour les stores avec PSP count et cap total
interface StoreWithPspCount extends Store {
  pspCount: number;
  pspCountError?: boolean; // true si le chargement PSP a échoué
  totalCapEur: number; // Cap total en euros (somme des caps daily des PSPs)
  status: "active" | "inactive";
}

export function StoresTable() {
  const router = useRouter()
  const [stores, setStores] = useState<StoreWithPspCount[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDnsRecordsDialogOpen, setIsDnsRecordsDialogOpen] = useState(false)
  const [newlyCreatedStoreId, setNewlyCreatedStoreId] = useState<string | null>(null)
  const [newlyCreatedDomainId, setNewlyCreatedDomainId] = useState<string | null>(null)

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedStore, setSelectedStore] = useState<StoreWithPspCount | null>(null)
  
  // États pour le dialog de statut du domaine
  const [isDomainStatusDialogOpen, setIsDomainStatusDialogOpen] = useState(false)
  const [selectedDomainForStatus, setSelectedDomainForStatus] = useState<string>('')
  const [selectedStoreIdForStatus, setSelectedStoreIdForStatus] = useState<string>('')
  const [selectedDomainIdForStatus, setSelectedDomainIdForStatus] = useState<string>('')
  
  const [selectedPlatform, setSelectedPlatform] = useState<StorePlatform>(StorePlatform.WOOCOMMERCE)
  const [shopifyConnecting, setShopifyConnecting] = useState(false)
  const [newStore, setNewStore] = useState({
    name: "",
    domain: "",
    payDomain: "",
    logoUrl: "",
    requiresShipping: true, // Par défaut, on demande l'adresse
    // Champs Shopify uniquement
    shopifyId: "",
    clientId: "",
    clientSecret: "",
  })

  // Mettre à jour le payDomain quand la plateforme ou le domaine change
  useEffect(() => {
    if (newStore.domain) {
      setNewStore(prev => ({
        ...prev,
        payDomain: `checkout.${prev.domain}`
      }))
    } else {
      setNewStore(prev => ({ ...prev, payDomain: "" }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, newStore.domain])

  // Fonction pour vérifier le statut d'un domaine existant via Cloudflare
  const handleExistingDomainStatusChange = (status: 'PENDING' | 'ACTIVE' | 'FAILED') => {
    if (status === 'ACTIVE') {
      toast.success('Domaine vérifié avec succès !')
    } else if (status === 'FAILED') {
      toast.error('Vérification échouée')
    }
  }

  // Fonction pour ouvrir le dialog de statut du domaine
  const handleOpenDomainStatus = (storeId: string, domainId: string, hostname: string) => {
    if (!domainId || !hostname) {
      toast.error('Ce store n\'a pas de domaine de paiement configuré')
      return
    }
    setSelectedDomainForStatus(hostname)
    setSelectedStoreIdForStatus(storeId)
    setSelectedDomainIdForStatus(domainId)
    setIsDomainStatusDialogOpen(true)
    // Le statut sera vérifié automatiquement par le composant DnsRecordsTable
  }
  const [editStorePlatform, setEditStorePlatform] = useState<StorePlatform>(StorePlatform.SHOPIFY)
  const [editStore, setEditStore] = useState({
    name: "",
    domain: "",
    shopifyId: "",
    payDomain: "",
    logoUrl: "",
    runner: "",
    requiresShipping: true,
  })
  // État pour gérer l'édition inline du runner
  const [editingRunner, setEditingRunner] = useState<string | null>(null)
  const [runnerValue, setRunnerValue] = useState<string>("")

  const { handleError } = useApiError()
  const searchParams = useSearchParams()

  // Handle Shopify OAuth callback notifications
  useEffect(() => {
    const shopifyConnected = searchParams.get('shopify_connected')
    const shopifyError = searchParams.get('shopify_error')

    if (shopifyConnected === 'true') {
      toast.success('Shopify connecté avec succès !')
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('shopify_connected')
      url.searchParams.delete('store_id')
      window.history.replaceState({}, '', url.pathname)
    } else if (shopifyError) {
      const errorMessages: Record<string, string> = {
        missing_params: 'Paramètres manquants dans la réponse Shopify',
        token_exchange_failed: "Échec de l'échange du token avec Shopify",
        internal: 'Erreur interne lors de la connexion Shopify',
        unknown: 'Erreur inconnue lors de la connexion Shopify',
      }
      toast.error(errorMessages[shopifyError] || 'Erreur de connexion Shopify')
      const url = new URL(window.location.href)
      url.searchParams.delete('shopify_error')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [searchParams])

  // Connect Shopify via OAuth for a given store
  const handleConnectShopify = useCallback(async (storeId: string) => {
    try {
      setShopifyConnecting(true)
      const result = await apiClient.shopify.generateOAuthUrl(storeId)
      if (result.success && result.oauthUrl) {
        window.location.href = result.oauthUrl
      } else {
        toast.error(result.error || "Impossible de générer l'URL OAuth Shopify")
        setShopifyConnecting(false)
      }
    } catch (err) {
      console.error('Failed to generate Shopify OAuth URL:', err)
      toast.error("Erreur lors de la connexion à Shopify")
      setShopifyConnecting(false)
    }
  }, [])

  // Charger les stores depuis l'API
  useEffect(() => {
    const loadStores = async () => {
      try {
        setLoading(true)
        setError(null)

        // Charger les stores
        const storesData = await apiClient.stores.getAll()

        // Calculer le nombre de PSP et cap total par store
        const storesWithPspCount: StoreWithPspCount[] = await Promise.all(
          storesData.map(async (store) => {
            try {
              const storePsps = await apiClient.storePsp.getByStore(store.id) as any[]
              const pspCount = storePsps.length
              // L'API retourne { psp: { dailyCapacityEur: ... } }
              const totalCapEur = storePsps.reduce((sum, sp) => sum + (sp.psp?.dailyCapacityEur || 0), 0)

              return {
                ...store,
                pspCount,
                totalCapEur,
                status: "active" as const
              }
            } catch (error) {
              console.error(`Erreur lors du chargement des PSP pour le store ${store.id}:`, error)
              return {
                ...store,
                pspCount: 0,
                pspCountError: true,
                totalCapEur: 0,
                status: "active" as const
              }
            }
          })
        )

        setStores(storesWithPspCount)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Une erreur est survenue')
        }
        console.error('Failed to load stores:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStores()
  }, []) // Pas de dépendance, charge une seule fois


  const handleAddStore = async () => {
    setIsSubmitting(true)
    let createdStore = null

    try {
      // Construire platformConfig selon la plateforme sélectionnée
      let platformConfig = null

      if (selectedPlatform === StorePlatform.SHOPIFY) {
        platformConfig = {
          shopifyId: newStore.shopifyId,
          clientId: newStore.clientId,
          clientSecret: newStore.clientSecret,
        }
      } else if (selectedPlatform === StorePlatform.WOOCOMMERCE) {
        platformConfig = {} // Vide pour WooCommerce (détection par domaine)
      }

      const storeData = {
        name: newStore.name,
        domain: newStore.domain,
        platform: selectedPlatform,
        platformConfig,
        requiresShipping: newStore.requiresShipping,
        // PayDomain pour checkout hébergé (requis pour tous)
        ...(newStore.payDomain ? { payDomain: newStore.payDomain } : {}),
        logoUrl: newStore.logoUrl || undefined,
      }

      createdStore = await apiClient.stores.create(storeData)

      // Si WooCommerce, rediriger vers la page d'intégration OAuth
      if (selectedPlatform === StorePlatform.WOOCOMMERCE) {
        toast.success("Boutique créée ! Connectez maintenant WooCommerce.")
        handleCloseDialog()
        router.push(`/boutiques/${createdStore.id}/integration`)
        return
      }

      // Si Shopify, lancer l'OAuth pour connecter le store
      if (selectedPlatform === StorePlatform.SHOPIFY && createdStore) {
        toast.success("Boutique créée ! Connexion à Shopify en cours...")
        handleCloseDialog()
        handleConnectShopify(createdStore.id)
        return
      }

    } catch (err: unknown) {
      // Afficher le message d'erreur dans un toast
      interface ErrorWithResponse {
        response?: { data?: { message?: string } }
        message?: string
      }
      const error = err as ErrorWithResponse
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Erreur lors de la création de la boutique'
      toast.error(errorMessage)

      // Si c'est une erreur de domaine, permettre de modifier
      if (errorMessage.includes('déjà utilisé')) {
        // Rester sur l'étape 2 pour permettre de changer le domaine
        setCurrentStep(2)
      }

      console.error('Failed to create store:', err)
      setIsSubmitting(false)
      return
    }

    // La boutique a été créée avec succès, maintenant recharger les données
    try {
      // Recharger les stores pour avoir les données complètes
      const storesData = await apiClient.stores.getAll()

      const storesWithPspCount: StoreWithPspCount[] = await Promise.all(
        storesData.map(async (store) => {
          try {
            const storePsps = await apiClient.storePsp.getByStore(store.id) as any[]
            const pspCount = storePsps.length
            const totalCapEur = storePsps.reduce((sum, sp) => sum + (sp.psp?.dailyCapacityEur || 0), 0)

            return {
              ...store,
              pspCount,
              totalCapEur,
              status: "active" as const
            }
          } catch (error) {
            console.error(`Erreur lors du chargement des PSP pour le store ${store.id}:`, error)
            return {
              ...store,
              pspCount: 0,
              totalCapEur: 0,
              status: "active" as const
            }
          }
        })
      )

      setStores(storesWithPspCount)
    } catch (reloadError) {
      // Si le rechargement échoue, ce n'est pas grave, la boutique existe déjà
      console.error('Erreur lors du rechargement des stores:', reloadError)
      // On affiche quand même le succès car la boutique a été créée
    }

    // Si un domaine a été créé, afficher le modal DNS
    if (createdStore?.payDomain?.id) {
      setNewlyCreatedStoreId(createdStore.id)
      setNewlyCreatedDomainId(createdStore.payDomain.id)
      setIsDnsRecordsDialogOpen(true)
    }

    setNewStore({
      name: "",
      domain: "",
      payDomain: "",
      logoUrl: "",
      requiresShipping: true,
      shopifyId: "",
      clientId: "",
      clientSecret: "",
    })
    setSelectedPlatform(StorePlatform.WOOCOMMERCE)
    setIsAddDialogOpen(false)
    setCurrentStep(1)
    setIsSubmitting(false)
    toast.success('Boutique créée avec succès')
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Pour WooCommerce : name + domain
      // Pour Shopify : name + domain + shopifyId + clientId + clientSecret
      const isValid = newStore.name && newStore.domain && isValidDomain(newStore.domain) &&
        (selectedPlatform === StorePlatform.WOOCOMMERCE || (newStore.shopifyId && newStore.clientId && newStore.clientSecret))

      if (isValid) {
        // Les deux passent directement à l'étape domaine de paiement
        setCurrentStep(2)
      }
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
    setNewStore({ name: "", domain: "", payDomain: "", logoUrl: "", requiresShipping: true, shopifyId: "", clientId: "", clientSecret: "" })
    setSelectedPlatform(StorePlatform.WOOCOMMERCE)
  }

  const handleDomainChange = (domain: string) => {
    setNewStore(prev => ({
      ...prev,
      domain,
      // Utiliser checkout. pour toutes les plateformes
      payDomain: domain ? `checkout.${domain}` : ""
    }))
  }

  const handleEditStore = (store: StoreWithPspCount) => {
    setSelectedStore(store)
    setEditStorePlatform(store.platform)

    // Extraire shopifyId depuis platformConfig si disponible
    let shopifyId = store.shopifyId || ""
    if (store.platform === StorePlatform.SHOPIFY && store.platformConfig && 'shopifyId' in store.platformConfig) {
      shopifyId = (typeof store.platformConfig.shopifyId === 'string' ? store.platformConfig.shopifyId : '') || shopifyId
    }

    setEditStore({
      name: store.name,
      domain: store.domain,
      shopifyId,
      payDomain: store.payDomain?.hostname || '',
      logoUrl: store.logoUrl || "",
      runner: store.runner || "",
      requiresShipping: store.requiresShipping ?? true,
    })
    setIsEditDialogOpen(true)
  }

  // Gérer l'édition inline du runner
  const handleRunnerEdit = (storeId: string, currentRunner: string | null) => {
    setEditingRunner(storeId)
    setRunnerValue(currentRunner || "")
  }

  const handleRunnerSave = async (storeId: string) => {
    try {
      await apiClient.stores.update(storeId, {
        runner: runnerValue.trim() || null,
      })
      // Mettre à jour le store local
      setStores(prev => prev.map(store => 
        store.id === storeId 
          ? { ...store, runner: runnerValue.trim() || null }
          : store
      ))
      setEditingRunner(null)
      setRunnerValue("")
      toast.success("Runner mis à jour")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du runner'
      toast.error(errorMessage)
      console.error('Failed to update runner:', err)
    }
  }

  const handleRunnerCancel = () => {
    setEditingRunner(null)
    setRunnerValue("")
  }

  const handleSaveEdit = async () => {
    if (selectedStore) {
      try {
        const updateData: UpdateStoreData = {
          name: editStore.name,
          domain: editStore.domain,
          requiresShipping: editStore.requiresShipping,
          payDomain: editStore.payDomain,
          logoUrl: editStore.logoUrl,
          runner: editStore.runner || null,
        }

        // Ne modifier la plateforme que si elle a changé
        const platformChanged = editStorePlatform !== selectedStore.platform
        if (platformChanged) {
          updateData.platform = editStorePlatform
        }

        // Ne modifier platformConfig que si la plateforme a changé ou si shopifyId a changé
        const existingConfig = selectedStore.platformConfig as any || {}
        const shopifyIdChanged = editStore.shopifyId !== existingConfig.shopifyId
        
        if (platformChanged || (editStorePlatform === StorePlatform.SHOPIFY && shopifyIdChanged)) {
          if (editStorePlatform === StorePlatform.SHOPIFY) {
            // Préserver les credentials existants (clientId, clientSecret, accessToken)
            updateData.platformConfig = {
              shopifyId: editStore.shopifyId,
              clientId: existingConfig.clientId || '',
              clientSecret: existingConfig.clientSecret || '',
              ...(existingConfig.accessToken && { accessToken: existingConfig.accessToken }),
            }
          }
        }

        const updatedStore = await apiClient.stores.update(selectedStore.id, updateData)

        setStores(stores.map(store =>
          store.id === selectedStore.id
            ? { ...store, ...updatedStore }
            : store
        ))
        setIsEditDialogOpen(false)
        setSelectedStore(null)
        toast.success('Boutique mise à jour avec succès')
      } catch (err) {
        const errorMessage = handleError(err)
        setError(errorMessage)
        toast.error(errorMessage)
        console.error('Failed to update store:', err)
      }
    }
  }



  const handleEditDomainChange = (domain: string) => {
    setEditStore(prev => ({
      ...prev,
      domain,
      payDomain: domain ? `checkout.${domain}` : ""
    }))
  }


  const handleOpenDelete = (store: StoreWithPspCount) => {
    setSelectedStore(store)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (selectedStore) {
      try {
        await apiClient.stores.delete(selectedStore.id)
        setStores(stores.filter(store => store.id !== selectedStore.id))
        setIsDeleteDialogOpen(false)
        setSelectedStore(null)
      } catch (err) {
        const errorMessage = handleError(err)
        setError(errorMessage)
        console.error('Failed to delete store:', err)
      }
    }
  }



  // Affichage du loading
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <StoreIcon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg font-semibold">Boutiques</CardTitle>
          </div>
          <div className="h-10 w-32 bg-muted/30 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden">
            {/* Table Header Skeleton */}
            <div className="border-b border-muted/20 p-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="h-4 w-16 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-muted/30 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-muted/30 rounded animate-pulse"></div>
              </div>
            </div>
            
            {/* Table Rows Skeleton */}
            <div className="space-y-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border-b border-muted/10 p-4 animate-pulse hover:bg-muted/5">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    {/* Store info */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted/30"></div>
                      <div>
                        <div className="h-4 w-24 bg-muted/30 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-muted/30 rounded"></div>
                      </div>
                    </div>
                    
                    {/* Storefront */}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-muted/30 rounded"></div>
                      <div className="h-4 w-16 bg-muted/30 rounded"></div>
                    </div>
                    
                    {/* Domain */}
                    <div>
                      <div className="h-4 w-20 bg-muted/30 rounded mb-1"></div>
                      <div className="h-3 w-24 bg-muted/30 rounded"></div>
                    </div>
                    
                    {/* PSP Count */}
                    <div className="h-6 w-16 bg-muted/30 rounded-full"></div>
                    
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <StoreIcon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg font-semibold">Boutiques</CardTitle>
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
            <StoreIcon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold">Boutiques</CardTitle>
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
              <span className="hidden sm:inline">Ajouter une boutique</span>
              <span className="sm:hidden">Ajouter</span>
            </Button>
          </DialogTrigger>
          <DialogContent className={`border-primary/20 ${currentStep === 2 ? '!max-w-2xl' : ''}`}>
            <DialogHeader>
              <DialogTitle>Ajouter une nouvelle boutique</DialogTitle>

              {/* Stepper - 2 étapes pour toutes les plateformes */}
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
                    Domaine
                  </span>
                </div>
              </div>
            </DialogHeader>
            
            {currentStep === 1 ? (
              <div className="grid gap-4 py-4">
                {/* Sélecteur de plateforme */}
                <div className="grid gap-2">
                  <Label>Plateforme e-commerce</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PLATFORM_TYPES.map((platform) => (
                      <div
                        key={platform.value}
                        onClick={() => !platform.disabled && setSelectedPlatform(platform.value)}
                        className={`relative rounded-xl border-2 p-4 transition-all overflow-visible ${
                          platform.disabled
                            ? 'border-muted/50 bg-muted/10 cursor-not-allowed opacity-60'
                            : selectedPlatform === platform.value
                            ? 'border-primary bg-primary/5 cursor-pointer'
                            : 'border-muted hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center justify-center w-12 h-12">
                            <Image
                              src={platform.icon}
                              alt={platform.label}
                              width={48}
                              height={48}
                              className="object-contain"
                            />
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-sm">{platform.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{platform.description}</div>
                          </div>
                        </div>
                        {platform.badge && (
                          <div className="absolute top-1.5 right-1.5 z-10">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30 leading-tight">
                              {platform.badge}
                            </Badge>
                          </div>
                        )}
                        {platform.disabled && (
                          <div className="absolute top-2 right-2 z-10">
                            <Badge variant="secondary" className="text-xs px-2 py-1 bg-muted text-muted-foreground">
                              À venir
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">Nom de la boutique</Label>
                  <Input
                    id="name"
                    value={newStore.name}
                    onChange={(e) => setNewStore(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ma Boutique"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Nom de domaine public</Label>
                  <Input
                    id="domain"
                    value={newStore.domain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    placeholder={selectedPlatform === StorePlatform.WOOCOMMERCE ? "maboutique.com" : "ma-boutique.com"}
                    className={newStore.domain && !isValidDomain(newStore.domain) ? "border-red-500" : ""}
                  />
                  {newStore.domain && !isValidDomain(newStore.domain) ? (
                    <p className="text-xs text-red-500">
                      Format invalide. Exemple : maboutique.com
                    </p>
                  ) : selectedPlatform === StorePlatform.WOOCOMMERCE ? (
                    <p className="text-xs text-muted-foreground">
                      Le domaine de votre site WordPress/WooCommerce
                    </p>
                  ) : null}
                </div>

                {/* Champs spécifiques à Shopify */}
                {selectedPlatform === StorePlatform.SHOPIFY && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="shopifyId">Identifiant Shopify</Label>
                      <div className="flex items-center relative">
                        <Input
                          id="shopifyId"
                          value={newStore.shopifyId}
                          onChange={(e) => setNewStore(prev => ({ ...prev, shopifyId: e.target.value }))}
                          placeholder="shop-12345"
                          className="pr-32"
                        />
                        <span className="absolute right-3 text-muted-foreground text-sm select-none pointer-events-none">
                          .myshopify.com
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="clientId">Client ID</Label>
                      <Input
                        id="clientId"
                        value={newStore.clientId}
                        onChange={(e) => setNewStore(prev => ({ ...prev, clientId: e.target.value }))}
                        placeholder="Client ID de votre app Shopify"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="clientSecret">Client Secret</Label>
                      <Input
                        id="clientSecret"
                        type="password"
                        value={newStore.clientSecret}
                        onChange={(e) => setNewStore(prev => ({ ...prev, clientSecret: e.target.value }))}
                        placeholder="Client Secret de votre app Shopify"
                      />
                    </div>

                    <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-3">
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Redirect URI à configurer dans votre app Shopify :</p>
                        <code className="text-xs bg-background px-2 py-1 rounded border select-all block overflow-x-auto">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/api/shopify/callback
                        </code>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Scopes requis :</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>write_orders</span>
                          <span>read_orders</span>
                          <span>write_customers</span>
                          <span>read_customers</span>
                          <span>write_products</span>
                          <span>read_products</span>
                          <span>write_themes</span>
                          <span>read_themes</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="logoUrl">URL du logo (optionnel)</Label>
                  <Input
                    id="logoUrl"
                    value={newStore.logoUrl}
                    onChange={(e) => setNewStore(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clic droit sur l&apos;image de votre boutique → &quot;Copier l&apos;adresse de l&apos;image&quot;
                  </p>
                </div>

                {/* Configuration produits virtuels */}
                <div className="flex items-start space-x-3 rounded-lg border border-muted/50 p-4 bg-muted/20">
                  <Checkbox
                    id="requiresShipping"
                    checked={newStore.requiresShipping}
                    onCheckedChange={(checked) =>
                      setNewStore(prev => ({ ...prev, requiresShipping: !!checked }))
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="requiresShipping"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Demander l&apos;adresse de livraison
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Décochez si vous vendez uniquement des produits virtuels ou téléchargeables (pas besoin d&apos;adresse physique)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="payDomain">Domaine de paiement</Label>
                  <Input
                    id="payDomain"
                    value={newStore.payDomain}
                    onChange={(e) => setNewStore(prev => ({ ...prev, payDomain: e.target.value }))}
                    placeholder="checkout.ma-boutique.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nous vous recommandons d&apos;utiliser un sous-domaine de votre domaine principal (ex: checkout.votre-domaine.com)
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={currentStep === 1 ? handleCloseDialog : handlePrevStep}
                disabled={isSubmitting || shopifyConnecting}
              >
                {currentStep === 1 ? "Annuler" : "Précédent"}
              </Button>
              {currentStep === 1 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={
                    isSubmitting ||
                    !newStore.name || !newStore.domain ||
                    (selectedPlatform === StorePlatform.SHOPIFY && (!newStore.shopifyId || !newStore.clientId || !newStore.clientSecret))
                  }
                >
                  Suivant
                </Button>
              ) : (
                <Button
                  onClick={handleAddStore}
                  disabled={isSubmitting || shopifyConnecting || !newStore.payDomain}
                >
                  {(isSubmitting || shopifyConnecting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedPlatform === StorePlatform.SHOPIFY
                    ? (shopifyConnecting ? "Connexion à Shopify..." : "Créer et connecter Shopify")
                    : "Ajouter la boutique"
                  }
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal d'édition des informations de base */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Éditer les informations de la boutique</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Sélecteur de plateforme */}
              <div className="grid gap-2">
                <Label>Plateforme e-commerce</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORM_TYPES.filter(p => !p.disabled).map((platform) => (
                    <div
                      key={platform.value}
                      onClick={() => setEditStorePlatform(platform.value)}
                      className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer ${
                        editStorePlatform === platform.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12">
                          <Image
                            src={platform.icon}
                            alt={platform.label}
                            width={48}
                            height={48}
                            className="object-contain"
                          />
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-sm">{platform.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{platform.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nom de la boutique</Label>
                <Input
                  id="edit-name"
                  value={editStore.name}
                  onChange={(e) => setEditStore(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ma Boutique"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-domain">Nom de domaine public</Label>
                <Input
                  id="edit-domain"
                  value={editStore.domain}
                  onChange={(e) => handleEditDomainChange(e.target.value)}
                  placeholder="ma-boutique.com"
                  className={editStore.domain && !isValidDomain(editStore.domain) ? "border-red-500" : ""}
                />
                {editStore.domain && !isValidDomain(editStore.domain) && (
                  <p className="text-xs text-red-500">
                    Format invalide. Exemple : maboutique.com
                  </p>
                )}
              </div>

              {/* Champs spécifiques à Shopify */}
              {editStorePlatform === StorePlatform.SHOPIFY && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-shopifyId">Identifiant Shopify</Label>
                  <div className="flex items-center relative">
                    <Input
                      id="edit-shopifyId"
                      value={editStore.shopifyId}
                      onChange={(e) => setEditStore(prev => ({ ...prev, shopifyId: e.target.value }))}
                      placeholder="shop-12345"
                      className="pr-32"
                    />
                    <span className="absolute right-3 text-muted-foreground text-sm select-none pointer-events-none">
                      .myshopify.com
                    </span>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-payDomain">Domaine de paiement</Label>
                <Input
                  id="edit-payDomain"
                  value={editStore.payDomain}
                  onChange={(e) => setEditStore(prev => ({ ...prev, payDomain: e.target.value }))}
                  placeholder="pay.ma-boutique.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-logoUrl">URL du logo (optionnel)</Label>
                <Input
                  id="edit-logoUrl"
                  value={editStore.logoUrl}
                  onChange={(e) => setEditStore(prev => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Clic droit sur l&apos;image de votre boutique → &quot;Copier l&apos;adresse de l&apos;image&quot;
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-runner">Runner (optionnel)</Label>
                <Input
                  id="edit-runner"
                  value={editStore.runner}
                  onChange={(e) => setEditStore(prev => ({ ...prev, runner: e.target.value }))}
                  placeholder="Nom de la personne responsable"
                />
                <p className="text-xs text-muted-foreground">
                  Nom de la personne responsable de cette boutique
                </p>
              </div>

              {/* Configuration produits virtuels */}
              <div className="flex items-start space-x-3 rounded-lg border border-muted/50 p-4 bg-muted/20">
                <Checkbox
                  id="edit-requiresShipping"
                  checked={editStore.requiresShipping}
                  onCheckedChange={(checked) =>
                    setEditStore(prev => ({ ...prev, requiresShipping: !!checked }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="edit-requiresShipping"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Demander l&apos;adresse de livraison
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Décochez si vous vendez uniquement des produits virtuels ou téléchargeables (pas besoin d&apos;adresse physique)
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={
                  !editStore.name || !editStore.domain ||
                  (editStorePlatform === StorePlatform.SHOPIFY && !editStore.shopifyId)
                }
              >
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Modal de confirmation de suppression */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle>Supprimer la boutique</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Êtes-vous sûr de vouloir supprimer &quot;{selectedStore?.name}&quot; ? Cette action est irréversible.
              </p>
            </DialogHeader>
            
            <div className="py-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                    <span className="text-destructive text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-destructive">Attention</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      La suppression de cette boutique entraînera :
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Perte de l&apos;historique des paiements</li>
                      <li>• Déconnexion définitive de Shopify</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Supprimer définitivement
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
                <TableHead className="text-foreground font-semibold">Store</TableHead>
                <TableHead className="text-foreground font-semibold">Type</TableHead>
                <TableHead className="text-foreground font-semibold">Domaine</TableHead>
                <TableHead className="text-foreground font-semibold">Runner</TableHead>
                <TableHead className="text-foreground font-semibold">PSP Connectés</TableHead>
                <TableHead className="text-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <TableRow key={store.id} className="border-b border-white/5 hover:bg-white/5">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                        <StoreIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{store.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {store.platform === StorePlatform.SHOPIFY && store.shopifyId
                            ? `ID: ${store.shopifyId}`
                            : `${store.platform}`}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <Badge variant="secondary" className="flex items-center gap-2 w-fit">
                        {store.platform === StorePlatform.SHOPIFY ? (
                          <>
                            <Image
                              src="/shopify.svg"
                              alt="Shopify"
                              width={16}
                              height={16}
                              className="flex-shrink-0"
                            />
                            Shopify
                          </>
                        ) : store.platform === StorePlatform.WOOCOMMERCE ? (
                          <>
                            <Image
                              src="/woocommerce.svg"
                              alt="WooCommerce"
                              width={16}
                              height={16}
                              className="flex-shrink-0"
                            />
                            WooCommerce
                          </>
                        ) : (
                          <>{store.platform}</>
                        )}
                      </Badge>
                      {store.platform === StorePlatform.SHOPIFY && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] w-fit ${
                            (store.platformConfig as any)?.accessToken
                              ? 'border-green-500/50 text-green-500'
                              : 'border-orange-500/50 text-orange-500'
                          }`}
                        >
                          {(store.platformConfig as any)?.accessToken ? "Connecté" : "Non connecté"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{store.domain}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {store.payDomain?.hostname ? (
                        <span className="font-mono">{store.payDomain.hostname}</span>
                      ) : (
                        <span className="italic">Checkout intégré (legacy)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingRunner === store.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={runnerValue}
                          onChange={(e) => setRunnerValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRunnerSave(store.id)
                            } else if (e.key === 'Escape') {
                              handleRunnerCancel()
                            }
                          }}
                          placeholder="Nom du runner"
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleRunnerSave(store.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleRunnerCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 min-h-[32px]"
                        onClick={() => handleRunnerEdit(store.id, store.runner || null)}
                        title="Cliquez pour éditer"
                      >
                        {store.runner ? (
                          <span className="text-sm">{store.runner}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Cliquez pour ajouter</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={store.pspCountError ? "destructive" : store.pspCount > 0 ? "default" : "secondary"}
                      >
                        {store.pspCountError ? "- PSP" : `${store.pspCount} PSP${store.pspCount !== 1 ? 's' : ''}`}
                      </Badge>
                      {store.totalCapEur > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground font-mono cursor-help">
                              Cap: {formatCurrencyNoDecimals(store.totalCapEur)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Plafond 24h total (€)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Icône Edit */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleEditStore(store)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Éditer les informations</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Icône Paiements */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500"
                            onClick={() => router.push(`/boutiques/${store.id}/paiements`)}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Configurer les PSP et le routage</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Icône Analytics */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-purple-500/10 hover:text-purple-500"
                            onClick={() => router.push(`/boutiques/${store.id}/analytics`)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Voir les analytics</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Icône More (Paramètres + Statut DNS + Supprimer) */}
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
                          {store.platform === StorePlatform.SHOPIFY && (
                            <DropdownMenuItem
                              onClick={() => handleConnectShopify(store.id)}
                              disabled={shopifyConnecting}
                            >
                              <Plug className="h-4 w-4 mr-2" />
                              {(store.platformConfig as any)?.accessToken ? "Reconnecter Shopify" : "Connecter Shopify"}
                            </DropdownMenuItem>
                          )}
                          {store.platform === StorePlatform.WOOCOMMERCE && (
                            <DropdownMenuItem asChild>
                              <a href={`/boutiques/${store.id}/integration`}>
                                <Plug className="h-4 w-4 mr-2" />
                                Intégration WooCommerce
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <a href={`/boutiques/${store.id}/meta-settings`}>
                              <Facebook className="h-4 w-4 mr-2" />
                              Meta Conversion API
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/boutiques/${store.id}/tiktok-settings`}>
                              <Music className="h-4 w-4 mr-2" />
                              TikTok Pixel
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/boutiques/${store.id}/shipping-settings`}>
                              <Truck className="h-4 w-4 mr-2" />
                              Configuration Livraison
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/boutiques/${store.id}/trust-badges`}>
                              <Shield className="h-4 w-4 mr-2" />
                              Trust Badges
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/boutiques/${store.id}/checkout-language`}>
                              <Languages className="h-4 w-4 mr-2" />
                              Langue du Checkout
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDomainStatus(store.id, store.payDomain?.id || '', store.payDomain?.hostname || '')}>
                            <Globe className="h-4 w-4 mr-2" />
                            Vérifier le statut DNS
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleOpenDelete(store)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialog de statut du domaine */}
      <Dialog open={isDomainStatusDialogOpen} onOpenChange={setIsDomainStatusDialogOpen}>
        <DialogContent className="border-primary/20 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Statut DNS du domaine</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Vérification du domaine : <span className="font-mono text-primary">{selectedDomainForStatus}</span>
            </p>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Section de vérification */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Globe className="h-3 w-3 text-primary-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Vérification DNS</p>
              </div>
            </div>

            {/* DNS Records depuis Cloudflare */}
            <DnsRecordsTable 
              storeId={selectedStoreIdForStatus}
              domainId={selectedDomainIdForStatus}
              onStatusChange={handleExistingDomainStatusChange}
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDomainStatusDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog DNS Records après création */}
      <Dialog open={isDnsRecordsDialogOpen} onOpenChange={setIsDnsRecordsDialogOpen}>
        <DialogContent className="border-primary/20 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Configuration DNS requise</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Votre boutique a été créée avec succès. Configurez maintenant les enregistrements DNS suivants :
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 py-4">
            {newlyCreatedStoreId && newlyCreatedDomainId && (
              <DnsRecordsTable 
                storeId={newlyCreatedStoreId}
                domainId={newlyCreatedDomainId}
                onStatusChange={(status) => {
                  if (status === 'ACTIVE') {
                    toast.success('Domaine vérifié avec succès !')
                  }
                }}
              />
            )}
          </div>
          
          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button 
              onClick={() => {
                setIsDnsRecordsDialogOpen(false)
                setNewlyCreatedStoreId(null)
                setNewlyCreatedDomainId(null)
              }}
            >
              J&apos;ai configuré les DNS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
