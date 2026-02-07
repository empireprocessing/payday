'use client'

import { AlertCircle, ArrowLeft, ShoppingCart } from 'lucide-react'
import type { Cart } from '@/lib/types'

interface CartLimitSuggestion {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

interface CheckoutCartLimitProps {
  cart: Cart
  store?: {
    name: string
    domain: string
    logoUrl?: string
  }
  maxAmount: number
  suggestions: CartLimitSuggestion[] | null
  newTotalAfterRemoval?: number
}

export default function CheckoutCartLimit({
  cart,
  store,
  maxAmount,
  suggestions,
  newTotalAfterRemoval
}: CheckoutCartLimitProps) {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {store?.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store?.name || 'Store'}
              className="h-10 max-w-[120px] object-contain"
            />
          ) : (
            <span className="text-lg font-semibold text-gray-900">{store?.name}</span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Montant maximum depassé
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 text-center mb-6">
            Le montant de votre panier ({formatPrice(cart.totalAmount, cart.currency)}) dépasse
            la limite autorisée de {formatPrice(maxAmount, cart.currency)}.
          </p>

          {/* Suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Pour continuer, retirez du panier :
              </h3>
              <ul className="space-y-2">
                {suggestions.map((item, index) => (
                  <li key={index} className="flex justify-between text-sm">
                    <span className="text-amber-800">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-amber-700 font-medium">
                      {formatPrice(item.unitPrice * item.quantity, cart.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              {newTotalAfterRemoval !== undefined && (
                <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between">
                  <span className="text-amber-900 font-medium">Nouveau total :</span>
                  <span className="text-amber-900 font-bold">
                    {formatPrice(newTotalAfterRemoval, cart.currency)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* No suggestions possible */}
          {!suggestions && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">
                Aucun ajustement possible. Veuillez réduire le contenu de votre panier
                pour passer sous la limite de {formatPrice(maxAmount, cart.currency)}.
              </p>
            </div>
          )}

          {/* Current cart items */}
          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Votre panier actuel</h3>
            <div className="space-y-2">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-gray-900">
                    {formatPrice(item.totalPrice, cart.currency)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-medium">
                <span>Total</span>
                <span>{formatPrice(cart.totalAmount, cart.currency)}</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <a
            href={store?.domain ? `https://${store.domain}/cart` : '#'}
            className="w-full py-3 px-6 bg-black hover:bg-gray-900 text-white font-medium text-base rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Modifier mon panier
          </a>
        </div>
      </main>
    </div>
  )
}
