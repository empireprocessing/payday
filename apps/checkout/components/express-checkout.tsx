'use client'

import { useState } from 'react'
import {
  ExpressCheckoutElement,
  useElements,
  useStripe
} from '@stripe/react-stripe-js'
import { handlePaymentSuccess, confirmPayment } from '@/lib/actions'
import { createPaymentFromCart } from '@/lib/cart-actions'
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js'

interface ExpressCheckoutProps {
  checkoutId: string
  amount: number
  requiresShipping?: boolean
  storeData?: {
    id: string
    name: string
    domain: string
    logoUrl?: string
    supportEmail?: string
    requiresShipping?: boolean
    platform?: string
    shippingMethodTitle?: string | null
  }
  onTrackingEvent?: (event: string, metadata?: Record<string, unknown>) => void
  onAvailabilityChange?: (isAvailable: boolean) => void
}

export function ExpressCheckout({
  checkoutId,
  amount,
  requiresShipping = true,
  storeData,
  onTrackingEvent,
  onAvailabilityChange
}: ExpressCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) {
      event.paymentFailed({
        reason: 'fail'
      })
      return
    }

    // Track la tentative de paiement express
    onTrackingEvent?.('express-payment-attempted', {
      timestamp: new Date().toISOString(),
      checkoutId,
      amount,
      method: event.expressPaymentType
    })

    // Récupérer les détails de l'événement Apple Pay / Google Pay
    // Priorité: shippingAddress (livraison) > billingDetails (facturation)
    const shippingAddress = event.shippingAddress
    const billingDetails = event.billingDetails

    const billingData = {
      email: billingDetails?.email || '',
      name: shippingAddress?.name || billingDetails?.name || '',
      phone: billingDetails?.phone || '',
      address: {
        // Utiliser l'adresse de livraison si disponible, sinon l'adresse de facturation
        line1: shippingAddress?.address?.line1 || billingDetails?.address?.line1 || '',
        line2: shippingAddress?.address?.line2 || billingDetails?.address?.line2 || '',
        city: shippingAddress?.address?.city || billingDetails?.address?.city || '',
        postal_code: shippingAddress?.address?.postal_code || billingDetails?.address?.postal_code || '',
        country: shippingAddress?.address?.country || billingDetails?.address?.country || 'FR',
        state: shippingAddress?.address?.state || billingDetails?.address?.state || '',
      }
    }

    try {
      // Créer le PaymentIntent MAINTENANT (mode deferred)
      // On ne passe PAS l'adresse ici - ExpressCheckoutElement va gérer le shipping
      // On passe juste l'email pour identifier le client
      console.log('🍎 Express Checkout: Création du PaymentIntent pour', checkoutId)
      const paymentResult = await createPaymentFromCart(
        checkoutId,
        {
          email: billingData.email,
          name: billingData.name,
          phone: billingData.phone,
          // PAS d'adresse - sinon Stripe refuse la modif côté client
        },
        undefined, // referer
        true // isExpressCheckout - pour ne pas mettre setup_future_usage côté API
      )

      if (!paymentResult.success || !paymentResult.clientSecret) {
        console.error('❌ Error creating PaymentIntent:', paymentResult.error)
        onTrackingEvent?.('express-payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          error: paymentResult.error || 'Error creating payment',
          method: event.expressPaymentType
        })
        event.paymentFailed({ reason: 'fail' })
        return
      }

      console.log('✅ PaymentIntent créé:', paymentResult.paymentIntentId)

      // Confirmer le paiement avec le clientSecret obtenu
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: paymentResult.clientSecret,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required'
      })

      if (confirmError) {
        // Notifier le backend de l'échec pour mettre à jour le statut en FAILED
        if (paymentResult.paymentIntentId) {
          confirmPayment(paymentResult.paymentIntentId, billingData).catch(() => {})
        }

        // Track l'échec du paiement express
        onTrackingEvent?.('express-payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          error: confirmError.message,
          method: event.expressPaymentType
        })

        event.paymentFailed({
          reason: 'fail'
        })
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Track le succès du paiement express
        onTrackingEvent?.('express-payment-successful', {
          timestamp: new Date().toISOString(),
          checkoutId,
          paymentIntentId: paymentIntent.id,
          method: event.expressPaymentType
        })

        // Traiter le succès du paiement
        const result = await handlePaymentSuccess(paymentIntent.id, billingData)

        if (result.success) {
          if (result.order) {
            // Inclure les données du store dans l'order pour la thank you page
            const orderWithStore = {
              ...result.order,
              store: storeData
            }
            sessionStorage.setItem('lastOrderData', JSON.stringify(orderWithStore))
          }

          // Rediriger vers la page de remerciement
          window.location.href = `${window.location.pathname}/thank-you`
        } else {
          event.paymentFailed({
            reason: 'fail'
          })
        }
      } else if (paymentIntent) {
        // Cas 3DS abandonné ou autre statut non-succeeded
        console.log(`⚠️ Express Payment non confirmé, statut: ${paymentIntent.status}`)
        confirmPayment(paymentIntent.id, billingData).catch(() => {})

        onTrackingEvent?.('express-payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          status: paymentIntent.status,
          method: event.expressPaymentType
        })

        event.paymentFailed({
          reason: 'fail'
        })
      }
    } catch (error) {
      console.error('❌ Error Express Checkout:', error)
      onTrackingEvent?.('express-payment-failed', {
        timestamp: new Date().toISOString(),
        checkoutId,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: event.expressPaymentType
      })
      event.paymentFailed({ reason: 'fail' })
    }
  }

  const options = {
    buttonHeight: 48,
    buttonTheme: {
      applePay: 'black' as const,
      googlePay: 'black' as const,
    },
    buttonType: {
      applePay: 'buy' as const,
      googlePay: 'buy' as const,
    },
    paymentMethods: {
      applePay: 'always' as const,
      googlePay: 'never' as const,
      paypal: 'never' as const,
      link: 'never' as const,
      klarna: 'never' as const,
    },
    layout: {
      maxColumns: 2,
      maxRows: 1,
    }
  }

  // Ne rien afficher si aucune méthode n'est disponible
  if (isAvailable === false) {
    return null
  }

  return (
    <div className="w-full">
      <ExpressCheckoutElement 
        options={options}
        onConfirm={handleConfirm}
        onReady={({ availablePaymentMethods }) => {
          // Vérifier si au moins une méthode est disponible
          const hasAvailableMethods = Boolean(availablePaymentMethods && 
            Object.keys(availablePaymentMethods).length > 0)
          
          setIsAvailable(hasAvailableMethods)
          onAvailabilityChange?.(hasAvailableMethods)
          
          if (hasAvailableMethods && availablePaymentMethods) {
            // Track l'affichage des méthodes de paiement express
            onTrackingEvent?.('express-checkout-displayed', {
              timestamp: new Date().toISOString(),
              checkoutId,
              methods: Object.keys(availablePaymentMethods)
            })
          }
        }}
        onClick={({ resolve }) => {
          // Track le clic sur un bouton de paiement express
          onTrackingEvent?.('express-checkout-clicked', {
            timestamp: new Date().toISOString(),
            checkoutId
          })

          // Configurer ce qu'Apple Pay / Google Pay doit collecter
          resolve({
            // Toujours demander l'email
            emailRequired: true,
            // Demander l'adresse de livraison si nécessaire
            ...(requiresShipping && {
              shippingAddressRequired: true,
              allowedShippingCountries: ['FR', 'BE', 'CH', 'LU', 'MC', 'DE', 'ES', 'IT', 'PT', 'NL', 'AT', 'GB'],
              shippingRates: [
                {
                  id: 'free-shipping',
                  displayName: storeData?.shippingMethodTitle || 'Free shipping',
                  amount: 0,
                },
              ],
            }),
            // Toujours demander le numéro de téléphone
            phoneNumberRequired: true,
          })
        }}
      />
    </div>
  )
}