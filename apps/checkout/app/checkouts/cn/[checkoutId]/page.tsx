import { getCheckoutInfo, getPublishableKey } from '@/lib/cart-actions'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Metadata } from 'next'
import CheckoutClient from './checkout-client'
import CheckoutExpired from './checkout-expired'
import CheckoutCartLimit from './checkout-cart-limit'
import type { CartItem } from '@/lib/types'

const MAX_CART_AMOUNT = 100 // euros

// Calcule les items à enlever pour retomber sous la limite
function calculateItemsToRemove(
  items: CartItem[],
  currentTotal: number,
  maxAmount: number
): { possible: boolean; itemsToRemove: Array<{ id: string; name: string; quantity: number; unitPrice: number }>; newTotal: number } {
  const amountToRemove = currentTotal - maxAmount

  // Si un seul item et il dépasse déjà la limite, impossible
  if (items.length === 1 && items[0].totalPrice > maxAmount) {
    return { possible: false, itemsToRemove: [], newTotal: currentTotal }
  }

  // Créer une liste plate d'items individuels
  const flatItems: Array<{ id: string; name: string; unitPrice: number }> = []
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      flatItems.push({ id: item.id, name: item.name, unitPrice: item.unitPrice })
    }
  }

  // Trier par prix croissant
  flatItems.sort((a, b) => a.unitPrice - b.unitPrice)

  let removedTotal = 0
  const itemsToRemove: Map<string, { id: string; name: string; quantity: number; unitPrice: number }> = new Map()

  for (const item of flatItems) {
    if (removedTotal >= amountToRemove) break
    const remainingValue = currentTotal - removedTotal - item.unitPrice
    if (remainingValue <= 0) continue

    removedTotal += item.unitPrice
    const existing = itemsToRemove.get(item.id)
    if (existing) {
      existing.quantity += 1
    } else {
      itemsToRemove.set(item.id, { id: item.id, name: item.name, quantity: 1, unitPrice: item.unitPrice })
    }
  }

  const newTotal = currentTotal - removedTotal
  if (newTotal <= maxAmount && newTotal > 0) {
    return { possible: true, itemsToRemove: Array.from(itemsToRemove.values()), newTotal }
  }

  return { possible: false, itemsToRemove: [], newTotal: currentTotal }
}

interface PageProps {
  params: Promise<{
    checkoutId: string
  }>
}

// Fonction pour générer les métadonnées de la page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { checkoutId } = await params;
  
  // Récupérer le domaine depuis les headers
  const headersList = await headers()
  const domain = headersList.get('host') || undefined

  // Récupérer les informations du store et du cart
  const checkoutInfo = await getCheckoutInfo(checkoutId, domain)
  
  if (checkoutInfo.success && checkoutInfo.store) {
    return {
      title: `Checkout - ${checkoutInfo.store.name}`,
      description: `Finalisez votre commande chez ${checkoutInfo.store.name}`,
    }
  }

  // Titre par défaut si on ne peut pas récupérer le nom de la boutique
  return {
    title: 'Checkout',
    description: 'Finalisez votre commande',
  }
}

export default async function CheckoutPage({ params }: PageProps) {
  const { checkoutId } = await params;

  // Récupérer le domaine depuis les headers
  const headersList = await headers()
  const domain = headersList.get('host') || undefined

  // Récupérer les informations du store et du cart en une seule requête
  const checkoutInfo = await getCheckoutInfo(checkoutId, domain)

  if (!checkoutInfo.success) {
    // Gérer spécifiquement l'erreur CHECKOUT_EXPIRED
    if (checkoutInfo.error === 'CHECKOUT_EXPIRED') {
      return <CheckoutExpired />
    }

    // Pour les autres erreurs, utiliser notFound()
    console.error('Erreur lors de la récupération des informations de checkout:', checkoutInfo.error)
    notFound()
  }

  if (!checkoutInfo.store || !checkoutInfo.cart) {
    console.error('Données de checkout incomplètes')
    notFound()
  }

  // Vérifier la limite de panier AVANT de charger le checkout
  if (checkoutInfo.cart.totalAmount > MAX_CART_AMOUNT) {
    console.log(`⚠️ Panier trop élevé: ${checkoutInfo.cart.totalAmount}€ > ${MAX_CART_AMOUNT}€`)
    const suggestions = calculateItemsToRemove(
      checkoutInfo.cart.items,
      checkoutInfo.cart.totalAmount,
      MAX_CART_AMOUNT
    )

    return (
      <CheckoutCartLimit
        cart={checkoutInfo.cart}
        store={checkoutInfo.store}
        maxAmount={MAX_CART_AMOUNT}
        suggestions={suggestions.possible ? suggestions.itemsToRemove : null}
        newTotalAfterRemoval={suggestions.possible ? suggestions.newTotal : undefined}
      />
    )
  }

  // Récupérer la publishableKey côté serveur
  const publishableKeyResult = await getPublishableKey(checkoutId)
  const publishableKey = publishableKeyResult.success ? publishableKeyResult.publishableKey : undefined

  return (
    <CheckoutClient
      cart={checkoutInfo.cart}
      store={checkoutInfo.store}
      checkoutId={checkoutId}
      publishableKey={publishableKey}
    />
  )
}