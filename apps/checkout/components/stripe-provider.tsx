'use client'

// stripe-provider.tsx

import React from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'


interface StripeProviderProps {
  children: React.ReactNode
  clientSecret?: string
  publishableKey: string
  // Mode deferred: permet d'initialiser Elements sans PaymentIntent
  amount?: number
  currency?: string
}

export function StripeProvider({ children, clientSecret, publishableKey, amount, currency }: StripeProviderProps) {
  // Créer une instance Stripe avec la clé publique du PSP sélectionné
  // Force English locale for Stripe Elements
  const stripePromise = React.useMemo(() => {
    return loadStripe(publishableKey, { locale: 'en' })
  }, [publishableKey])

  const options: StripeElementsOptions | undefined = React.useMemo(() => {
    // Si on a un clientSecret, l'utiliser (mode classique)
    if (clientSecret) {
      return { clientSecret }
    }

    // Mode deferred: initialiser avec amount et currency pour ExpressCheckout
    if (amount && currency) {
      return {
        mode: 'payment' as const,
        amount: Math.round(amount * 100), // Stripe attend des centimes
        currency: currency.toLowerCase(),
        appearance: {
          theme: 'stripe' as const,
        },
      }
    }

    // Fallback: pas d'options (pour CardElements legacy)
    return undefined
  }, [clientSecret, amount, currency])

  // Forcer un remount complet d'Elements quand les options changent
  const elementsKey = React.useMemo(() =>
    `${publishableKey}:${clientSecret || ''}:${amount || ''}:${currency || ''}`,
    [publishableKey, clientSecret, amount, currency]
  )

  return (
    <Elements key={elementsKey} stripe={stripePromise} options={options}>
      {children}
    </Elements>
  )
}
