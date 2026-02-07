'use client'

import React, { useEffect, useRef } from 'react'
import { useCheckoutTracking } from '@/lib/use-checkout-tracking'

interface CheckoutTrackingWrapperProps {
  checkoutId: string
  children: React.ReactNode
}

export function CheckoutTrackingWrapper({ checkoutId, children }: CheckoutTrackingWrapperProps) {
  const tracking = useCheckoutTracking({ checkoutId })
  const hasTrackedInitiated = useRef(false)
  const hasTrackedPaymentStarted = useRef(false)

  // Track l'initiation du checkout au montage du composant
  useEffect(() => {
    if (!hasTrackedInitiated.current) {
      // checkout-initiated est tracké côté API, pas côté client
      hasTrackedInitiated.current = true
    }
  }, [tracking])

  // Fonction pour tracker les événements de formulaire
  const trackFormEvents = () => {
    // Track quand l'utilisateur remplit ses infos personnelles
    const customerForm = document.getElementById('customer-form') as HTMLFormElement
    if (customerForm) {
      customerForm.addEventListener('submit', () => {
        tracking.trackCustomerInfoEntered({
          timestamp: new Date().toISOString(),
          formType: 'customer-info'
        })
      })
    }

    // Track les événements Stripe Elements
    const trackStripeEvents = () => {
      const cardNumberElement = document.querySelector('[data-elements-stable-field-name="cardNumber"]')
      const cardExpiryElement = document.querySelector('[data-elements-stable-field-name="cardExpiry"]')
      const cardCvcElement = document.querySelector('[data-elements-stable-field-name="cardCvc"]')

      // Track quand l'utilisateur commence à taper dans les champs de paiement
      if (cardNumberElement && !hasTrackedPaymentStarted.current) {
        cardNumberElement.addEventListener('input', () => {
          if (!hasTrackedPaymentStarted.current) {
            tracking.trackPaymentInfoStarted({
              timestamp: new Date().toISOString(),
              field: 'cardNumber'
            })
            hasTrackedPaymentStarted.current = true
          }
        })
      }

      // Track quand tous les champs sont complétés
      const checkAllFieldsComplete = () => {
        const cardNumberComplete = cardNumberElement?.getAttribute('data-complete') === 'true'
        const cardExpiryComplete = cardExpiryElement?.getAttribute('data-complete') === 'true'
        const cardCvcComplete = cardCvcElement?.getAttribute('data-complete') === 'true'

        if (cardNumberComplete && cardExpiryComplete && cardCvcComplete) {
          tracking.trackPaymentInfoCompleted({
            timestamp: new Date().toISOString(),
            allFieldsComplete: true
          })
        }
      }

      // Écouter les changements sur tous les champs
      ;[cardNumberElement, cardExpiryElement, cardCvcElement].forEach(element => {
        element?.addEventListener('change', checkAllFieldsComplete)
      })
    }

    // Attendre que Stripe Elements soit chargé
    const checkStripeElements = setInterval(() => {
      if (document.querySelector('[data-elements-stable-field-name]')) {
        trackStripeEvents()
        clearInterval(checkStripeElements)
      }
    }, 100)
  }

  // Track les événements de formulaire après le montage
  useEffect(() => {
    trackFormEvents()
  }, [])

  // Exposer les fonctions de tracking aux enfants via context ou props
  const contextValue = {
    tracking,
    trackPayButtonClicked: () => {
      tracking.trackPayButtonClicked({
        timestamp: new Date().toISOString(),
        action: 'pay-button-clicked'
      })
    },
    trackPaymentAttempted: () => {
      tracking.trackPaymentAttempted({
        timestamp: new Date().toISOString(),
        action: 'payment-attempted'
      })
    },
    trackPaymentSuccessful: () => {
      tracking.trackPaymentSuccessful({
        timestamp: new Date().toISOString(),
        action: 'payment-successful'
      })
    },
    trackPaymentFailed: (error?: string) => {
      tracking.trackPaymentFailed({
        timestamp: new Date().toISOString(),
        action: 'payment-failed',
        error
      })
    }
  }

  return (
    <div data-checkout-id={checkoutId}>
      {children}
    </div>
  )
}


