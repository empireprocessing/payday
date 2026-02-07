'use client'

// payment-form.tsx — Basis Theory Elements version

import React, { useState, useTransition, useEffect, useRef } from 'react'
import {
  CardNumberElement,
  CardExpirationDateElement,
  CardVerificationCodeElement,
  useBasisTheory,
} from '@basis-theory/react-elements'
import type {
  CardNumberElementEvents,
  CardExpirationDateElementEvents,
  CardVerificationCodeElementEvents,
  CardElementStyle,
} from '@basis-theory/react-elements'
import { createPaymentBT, confirmPaymentBT } from '@/lib/cart-actions'
import { loadStripe } from '@stripe/stripe-js'
import countries from "i18n-iso-countries"
import './stripe-elements.css'

// Initialize countries library
// eslint-disable-next-line @typescript-eslint/no-require-imports
countries.registerLocale(require("i18n-iso-countries/langs/fr.json"))

interface PaymentFormProps {
  amount: number
  checkoutId: string
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  }
  storeData?: {
    id: string
    name: string
    domain: string
    logoUrl?: string
    supportEmail?: string
    requiresShipping?: boolean
    platform?: string
  }
  onPaymentReady?: (handlers: {
    handleSubmit: (e: React.FormEvent) => void
    isLoading: boolean
    isPending: boolean
    canSubmit: boolean
  }) => void
  onMessageChange?: (message: string) => void
  onTrackingEvent?: (event: string, metadata?: Record<string, unknown>) => void
}

// Fonction pour convertir le nom du pays en code ISO à 2 caractères
function getCountryCode(countryName: string): string {
  if (!countryName) return ''
  if (countryName.length === 2) return countryName.toUpperCase()
  const code = countries.getAlpha2Code(countryName, 'fr')
  return code || countryName
}

// BT Element styles matching the existing Stripe Elements appearance
const btElementStyle: CardElementStyle = {
  base: {
    color: '#000000',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    '::placeholder': {
      color: 'transparent',
    },
  },
  invalid: {
    color: 'rgb(239, 68, 68)',
  },
  complete: {
    color: '#000000',
  },
  empty: {
    color: '#000000',
    '::placeholder': {
      color: 'transparent',
    },
  },
}

export function PaymentForm({ amount, checkoutId, customerData, storeData, onPaymentReady, onMessageChange, onTrackingEvent }: PaymentFormProps) {
  const { bt } = useBasisTheory()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string>('')

  // Element state for CSS classes
  const [cardNumberState, setCardNumberState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: boolean }>({ focused: false, empty: true, complete: false, error: false })
  const [cardExpiryState, setCardExpiryState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: boolean }>({ focused: false, empty: true, complete: false, error: false })
  const [cardCvcState, setCardCvcState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: boolean }>({ focused: false, empty: true, complete: false, error: false })

  const hasTrackedPaymentStarted = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bt) return

    setIsLoading(true)
    setMessage('')
    if (onMessageChange) onMessageChange('')

    onTrackingEvent?.('payment-attempted', {
      timestamp: new Date().toISOString(),
      checkoutId,
      amount,
    })

    try {
      // 1. Create a token intent via BT SDK
      const tokenIntent = await bt.tokenIntents.create({
        type: 'card',
        data: {
          number: bt.createElement('cardNumber', { targetId: 'bt-card-number' }),
          expiration_month: bt.createElement('cardExpirationDate', { targetId: 'bt-card-expiry' }).month(),
          expiration_year: bt.createElement('cardExpirationDate', { targetId: 'bt-card-expiry' }).year(),
          cvc: bt.createElement('cardVerificationCode', { targetId: 'bt-card-cvc' }),
        } as any,
      })

      console.log('✅ Token Intent créé:', tokenIntent.id)

      // 2. Collect billing data
      let billingData: {
        email: string
        name: string
        phone: string
        address: {
          line1: string
          line2: string
          city: string
          postal_code: string
          country: string
          state: string
        }
      }

      if (customerData?.email && customerData?.name && customerData?.address?.line1) {
        billingData = {
          email: customerData.email || '',
          name: customerData.name || '',
          phone: customerData.phone || '',
          address: {
            line1: customerData.address?.line1 || '',
            line2: customerData.address?.line2 || '',
            city: customerData.address?.city || '',
            postal_code: customerData.address?.postal_code || '',
            country: getCountryCode(customerData.address?.country || ''),
            state: customerData.address?.state || '',
          },
        }
      } else {
        // Fallback: read from DOM
        const fullNameInput = (document.getElementById('fullName') as HTMLInputElement)?.value || ''
        const firstName = (document.getElementById('firstName') as HTMLInputElement)?.value || ''
        const lastName = (document.getElementById('lastName') as HTMLInputElement)?.value || ''
        const name = fullNameInput || `${firstName} ${lastName}`.trim()

        billingData = {
          email: (document.getElementById('email') as HTMLInputElement)?.value || '',
          name,
          phone: (document.getElementById('phone') as HTMLInputElement)?.value || '',
          address: {
            line1: (document.getElementById('address') as HTMLInputElement)?.value || '',
            line2: (document.getElementById('line2') as HTMLInputElement)?.value || '',
            city: (document.getElementById('city') as HTMLInputElement)?.value || '',
            postal_code: (document.getElementById('postalCode') as HTMLInputElement)?.value || '',
            country: getCountryCode((document.getElementById('country') as HTMLSelectElement)?.value || ''),
            state: (document.getElementById('state') as HTMLInputElement)?.value || '',
          },
        }
      }

      console.log('💳 Envoi du paiement BT pour le checkout:', checkoutId)

      // 3. Send to backend
      const result = await createPaymentBT(checkoutId, tokenIntent.id, billingData)

      if (!result.success) {
        // Handle cart limit exceeded error
        if (result.error === 'CART_AMOUNT_EXCEEDED' && result.cartLimitExceeded) {
          const limit = result.cartLimitExceeded
          let errorMsg = `Le montant maximum autorisé est de ${limit.maxAmount}€. Votre panier est à ${limit.currentAmount.toFixed(2)}€.`
          if (limit.suggestions && limit.suggestions.length > 0) {
            const itemsToRemove = limit.suggestions.map(s => `${s.quantity}x ${s.name}`).join(', ')
            errorMsg += ` Pour continuer, retirez du panier : ${itemsToRemove} (nouveau total : ${limit.newTotalAfterRemoval?.toFixed(2)}€).`
          } else if (limit.message) {
            errorMsg = limit.message
          }
          setMessage(errorMsg)
          if (onMessageChange) onMessageChange(errorMsg)
        } else {
          const errorMessage = 'An error occurred, please try again.'
          setMessage(errorMessage)
          if (onMessageChange) onMessageChange(errorMessage)
        }

        onTrackingEvent?.('payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          error: result.error,
        })
        setIsLoading(false)
        return
      }

      // 4. Handle status
      if (result.status === 'succeeded') {
        // Payment succeeded immediately
        onTrackingEvent?.('payment-successful', {
          timestamp: new Date().toISOString(),
          checkoutId,
          paymentIntentId: result.paymentIntentId,
        })

        startTransition(async () => {
          if (result.order) {
            const orderWithStore = { ...result.order, store: storeData }
            sessionStorage.setItem('lastOrderData', JSON.stringify(orderWithStore))
          }
          window.location.href = `${window.location.pathname}/thank-you`
        })
        return
      }

      if (result.status === 'requires_action') {
        // 3DS required - load Stripe.js lazily for handleNextAction
        console.log('🔐 3DS requis, chargement de Stripe.js...')

        if (!result.platformPublishableKey || !result.clientSecret) {
          throw new Error('Missing 3DS data from backend')
        }

        const stripe = await loadStripe(result.platformPublishableKey, {
          stripeAccount: result.stripeConnectedAccountId,
        })

        if (!stripe) {
          throw new Error('Failed to load Stripe.js')
        }

        const { error: threeDSError } = await stripe.handleNextAction({
          clientSecret: result.clientSecret,
        })

        if (threeDSError) {
          console.log('❌ 3DS échoué:', threeDSError.message)
          onTrackingEvent?.('payment-failed', {
            timestamp: new Date().toISOString(),
            checkoutId,
            error: threeDSError.message,
          })
          const errorMessage = 'An error occurred, please try again.'
          setMessage(errorMessage)
          if (onMessageChange) onMessageChange(errorMessage)
          setIsLoading(false)
          return
        }

        // 3DS succeeded - confirm with backend
        console.log('✅ 3DS réussi, confirmation...')
        const confirmResult = await confirmPaymentBT(result.paymentIntentId!, billingData)

        if (confirmResult.success) {
          onTrackingEvent?.('payment-successful', {
            timestamp: new Date().toISOString(),
            checkoutId,
            paymentIntentId: result.paymentIntentId,
          })

          startTransition(async () => {
            if (confirmResult.order) {
              const orderWithStore = { ...confirmResult.order, store: storeData }
              sessionStorage.setItem('lastOrderData', JSON.stringify(orderWithStore))
            }
            window.location.href = `${window.location.pathname}/thank-you`
          })
        } else {
          onTrackingEvent?.('payment-failed', {
            timestamp: new Date().toISOString(),
            checkoutId,
            error: confirmResult.error,
          })
          const errorMessage = 'An error occurred, please try again.'
          setMessage(errorMessage)
          if (onMessageChange) onMessageChange(errorMessage)
        }
        return
      }

      // Unknown status
      const errorMessage = 'An error occurred, please try again.'
      setMessage(errorMessage)
      if (onMessageChange) onMessageChange(errorMessage)
    } catch (err) {
      console.error('Payment error:', err)
      const errorMessage = 'An unexpected error occurred'
      setMessage(errorMessage)
      if (onMessageChange) onMessageChange(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = bt && !isLoading && !isPending

  // Element event handlers
  const handleCardNumberChange = (event: any) => {
    setCardNumberState(prev => ({
      ...prev,
      empty: event.empty,
      complete: event.complete,
      error: !event.valid && !event.empty,
    }))
    if (!hasTrackedPaymentStarted.current && !event.empty) {
      hasTrackedPaymentStarted.current = true
      onTrackingEvent?.('payment-info-started', {
        timestamp: new Date().toISOString(),
        checkoutId,
        field: 'cardNumber',
      })
    }
    checkAllComplete('cardNumber', event.complete)
  }

  const handleCardExpiryChange = (event: any) => {
    setCardExpiryState(prev => ({
      ...prev,
      empty: event.empty,
      complete: event.complete,
      error: !event.valid && !event.empty,
    }))
    if (!hasTrackedPaymentStarted.current && !event.empty) {
      hasTrackedPaymentStarted.current = true
      onTrackingEvent?.('payment-info-started', {
        timestamp: new Date().toISOString(),
        checkoutId,
        field: 'cardExpiry',
      })
    }
    checkAllComplete('cardExpiry', event.complete)
  }

  const handleCardCvcChange = (event: any) => {
    setCardCvcState(prev => ({
      ...prev,
      empty: event.empty,
      complete: event.complete,
      error: !event.valid && !event.empty,
    }))
    if (!hasTrackedPaymentStarted.current && !event.empty) {
      hasTrackedPaymentStarted.current = true
      onTrackingEvent?.('payment-info-started', {
        timestamp: new Date().toISOString(),
        checkoutId,
        field: 'cardCvc',
      })
    }
    checkAllComplete('cardCvc', event.complete)
  }

  const checkAllComplete = (changedField: string, changedComplete: boolean) => {
    const allComplete =
      (changedField === 'cardNumber' ? changedComplete : cardNumberState.complete) &&
      (changedField === 'cardExpiry' ? changedComplete : cardExpiryState.complete) &&
      (changedField === 'cardCvc' ? changedComplete : cardCvcState.complete)
    if (allComplete) {
      onTrackingEvent?.('payment-info-completed', {
        timestamp: new Date().toISOString(),
        checkoutId,
        allFieldsComplete: true,
      })
    }
  }

  // Expose handlers to parent
  useEffect(() => {
    if (onPaymentReady) {
      onPaymentReady({
        handleSubmit,
        isLoading,
        isPending,
        canSubmit: Boolean(canSubmit),
      })
    }
  }, [onPaymentReady, isLoading, isPending, canSubmit])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          {/* Card Number */}
          <div>
            <div className={`stripe-element-container ${
              cardNumberState.focused ? 'focused' : ''
            } ${
              cardNumberState.empty ? 'empty' : ''
            } ${
              cardNumberState.error ? 'invalid' : ''
            }`}>
              <CardNumberElement
                id="bt-card-number"
                style={btElementStyle}
                placeholder=""
                onChange={handleCardNumberChange as any}
                onFocus={() => setCardNumberState(prev => ({ ...prev, focused: true }))}
                onBlur={() => setCardNumberState(prev => ({ ...prev, focused: false }))}
              />
              <label className="stripe-element-label">
                Card number
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Expiration Date */}
            <div className="flex-1">
              <div className={`stripe-element-container ${
                cardExpiryState.focused ? 'focused' : ''
              } ${
                cardExpiryState.empty ? 'empty' : ''
              } ${
                cardExpiryState.error ? 'invalid' : ''
              }`}>
                <CardExpirationDateElement
                  id="bt-card-expiry"
                  style={btElementStyle}
                  placeholder=""
                  onChange={handleCardExpiryChange as any}
                  onFocus={() => setCardExpiryState(prev => ({ ...prev, focused: true }))}
                  onBlur={() => setCardExpiryState(prev => ({ ...prev, focused: false }))}
                />
                <label className="stripe-element-label">
                  MM/YY
                </label>
              </div>
            </div>

            {/* CVC */}
            <div className="flex-1">
              <div className={`stripe-element-container ${
                cardCvcState.focused ? 'focused' : ''
              } ${
                cardCvcState.empty ? 'empty' : ''
              } ${
                cardCvcState.error ? 'invalid' : ''
              }`}>
                <CardVerificationCodeElement
                  id="bt-card-cvc"
                  style={btElementStyle}
                  placeholder=""
                  onChange={handleCardCvcChange as any}
                  onFocus={() => setCardCvcState(prev => ({ ...prev, focused: true }))}
                  onBlur={() => setCardCvcState(prev => ({ ...prev, focused: false }))}
                />
                <label className="stripe-element-label">
                  CVC
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
