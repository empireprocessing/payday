'use client'

// payment-form.tsx

import React, { useState, useTransition, useEffect, useRef } from 'react'
import {
  CardCvcElement, CardExpiryElement, CardNumberElement, useElements,
  useStripe
} from '@stripe/react-stripe-js'
import { handlePaymentSuccess, confirmPayment } from '@/lib/actions'
import { retryPayment } from '@/lib/actions'
import { createPaymentFromCart } from '@/lib/cart-actions'
import { elementStyles, elementClasses } from '@/lib/stripe-element-styles'
import countries from "i18n-iso-countries"
import './stripe-elements.css'

// Initialize countries library
// eslint-disable-next-line @typescript-eslint/no-require-imports
countries.registerLocale(require("i18n-iso-countries/langs/fr.json"))

interface PaymentFormProps {
  clientSecret?: string // Optionnel : sera créé au moment du submit
  paymentIntentId?: string
  amount: number
  checkoutId: string // Requis maintenant pour créer le PaymentIntent
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
  onReinitStripe?: (payload: { clientSecret: string; publishableKey: string; paymentIntentId?: string }) => void
  onMessageChange?: (message: string) => void
  onTrackingEvent?: (event: string, metadata?: Record<string, unknown>) => void
}

// Fonction pour convertir le nom du pays en code ISO à 2 caractères
function getCountryCode(countryName: string): string {
  if (!countryName) return ''
  
  // Si c'est déjà un code à 2 caractères, le retourner tel quel
  if (countryName.length === 2) {
    return countryName.toUpperCase()
  }
  
  // Convertir le nom du pays en code ISO
  const code = countries.getAlpha2Code(countryName, 'fr')
  return code || countryName // Fallback sur le nom original si pas trouvé
}

export function PaymentForm({ clientSecret, paymentIntentId, amount, checkoutId, customerData, storeData, onPaymentReady, onReinitStripe, onMessageChange, onTrackingEvent }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string>('')
  const [currentClientSecret, setCurrentClientSecret] = useState(clientSecret)

  useEffect(() => {
    if (clientSecret) {
      setCurrentClientSecret(clientSecret)
    }
  }, [clientSecret])
  
  // États pour gérer les classes CSS des éléments Stripe
  const [cardNumberState, setCardNumberState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: unknown }>({ focused: false, empty: true, complete: false, error: null })
  const [cardExpiryState, setCardExpiryState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: unknown }>({ focused: false, empty: true, complete: false, error: null })
  const [cardCvcState, setCardCvcState] = useState<{ focused: boolean; empty: boolean; complete: boolean; error: unknown }>({ focused: false, empty: true, complete: false, error: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage('')
    if (onMessageChange) onMessageChange('')

    // Track la tentative de paiement
    onTrackingEvent?.('payment-attempted', {
      timestamp: new Date().toISOString(),
      checkoutId,
      amount
    })

    try {
      const cardNumberElement = elements.getElement(CardNumberElement)
      if (!cardNumberElement) {
        setMessage('Error: card element not found')
        return
      }

      // ✨ NOUVEAU: Créer le PaymentIntent MAINTENANT (pas au chargement de la page)
      if (!checkoutId) {
        setMessage('Error: checkout ID missing')
        setIsLoading(false)
        return
      }

      // Récupérer les données de facturation
      // Priorité: utiliser customerData prop si fourni, sinon lire le DOM
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
        // Utiliser les données passées par le parent (checkout-client)
        billingData = {
          email: customerData.email || '',
          name: customerData.name || '',
          phone: customerData.phone || '',
          address: {
            line1: customerData.address?.line1 || '',
            line2: customerData.address?.line2 || '',
            city: customerData.address?.city || '',
            postal_code: customerData.address?.postal_code || '',
            country: customerData.address?.country || '',
            state: customerData.address?.state || '',
          }
        }
      } else {
        // Fallback: lire les données du DOM (legacy support)
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
            country: (document.getElementById('country') as HTMLSelectElement)?.value || '',
            state: (document.getElementById('state') as HTMLInputElement)?.value || '',
          }
        }
      }

      console.log('💳 Création du PaymentIntent pour le checkout:', checkoutId)
      console.log('👤 Données client envoyées à Stripe:', {
        email: billingData.email,
        name: billingData.name,
        hasAddress: !!billingData.address.line1
      })

      const paymentResult = await createPaymentFromCart(checkoutId, billingData)

      if (!paymentResult.success || !paymentResult.clientSecret) {
        // Gérer l'erreur de limite de panier
        if (paymentResult.error === 'CART_AMOUNT_EXCEEDED' && paymentResult.cartLimitExceeded) {
          const limit = paymentResult.cartLimitExceeded
          let errorMsg = `Le montant maximum autorisé est de ${limit.maxAmount}€. Votre panier est à ${limit.currentAmount.toFixed(2)}€.`

          if (limit.suggestions && limit.suggestions.length > 0) {
            const itemsToRemove = limit.suggestions.map(s =>
              `${s.quantity}x ${s.name}`
            ).join(', ')
            errorMsg += ` Pour continuer, retirez du panier : ${itemsToRemove} (nouveau total : ${limit.newTotalAfterRemoval?.toFixed(2)}€).`
          } else if (limit.message) {
            errorMsg = limit.message
          }

          setMessage(errorMsg)
          if (onMessageChange) onMessageChange(errorMsg)
        } else {
          setMessage(paymentResult.error || 'Error creating payment')
          if (onMessageChange) onMessageChange(paymentResult.error || 'Error creating payment')
        }
        setIsLoading(false)
        return
      }

      console.log('✅ PaymentIntent créé:', paymentResult.paymentIntentId)
      const paymentSecret = paymentResult.clientSecret

      const { error, paymentIntent } = await stripe.confirmCardPayment(paymentSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: billingData.name,
            email: billingData.email,
            phone: billingData.phone,
            address: {
              line1: billingData.address.line1,
              line2: billingData.address.line2,
              city: billingData.address.city,
              state: billingData.address.state,
              postal_code: billingData.address.postal_code,
              country: getCountryCode(billingData.address.country) || 'FR', // Convertir en code ISO
            },
          },
        }
      })

      if (error) {
        // Gestion des codes récupérables -> retry côté serveur avec autre PSP, puis message générique
        const code = (error as { code?: string })?.code ||
                    (error as { decline_code?: string })?.decline_code ||
                    (error as { code?: string })?.code ||
                    (error as { decline_code?: string })?.decline_code

        const recoverableCodes = new Set([
          'card_declined', 'authentication_required', 'insufficient_funds', 'do_not_honor',
          'issuer_not_available', 'processing_error', 'try_again_later', 'reenter_transaction',
          'approve_with_id', 'generic_decline', 'card_velocity_exceeded', 'card_not_supported',
          'currency_not_supported', 'transaction_not_allowed', 'not_permitted', 'service_not_allowed',
          'call_issuer'
        ])

        // Notifier le backend de l'échec pour mettre à jour le statut en FAILED
        // (utilise le paymentIntentId du PaymentIntent créé plus haut)
        if (paymentResult.paymentIntentId) {
          confirmPayment(paymentResult.paymentIntentId, billingData).catch(() => {
            // Silent - le backend vérifiera le statut Stripe et mettra FAILED
          })
        }

        if (code && recoverableCodes.has(code)) {
          try {
            const prevPi = paymentResult.paymentIntentId || ''
            const retry = await retryPayment(prevPi, checkoutId, code)
            if (retry?.success && retry?.clientSecret && retry?.publishableKey) {
              if (onReinitStripe) {
                onReinitStripe({ clientSecret: retry.clientSecret, publishableKey: retry.publishableKey, paymentIntentId: retry.paymentIntentId })
              } else {
                setCurrentClientSecret(retry.clientSecret)
              }
            }
          } catch (re) {
            // Silent error handling
          }
        }
        // Track l'échec du paiement
        onTrackingEvent?.('payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          error: error.message,
          code
        })

        // Toujours afficher un message générique
        const errorMessage = 'An error occurred, please try again.'
        setMessage(errorMessage)
        if (onMessageChange) onMessageChange(errorMessage)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Track le succès du paiement
        onTrackingEvent?.('payment-successful', {
          timestamp: new Date().toISOString(),
          checkoutId,
          paymentIntentId: paymentIntent.id
        })

        startTransition(async () => {
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

            window.location.href = `${window.location.pathname}/thank-you`
          } else {
            const errorMessage = result.error || 'Error processing payment'
            setMessage(errorMessage)
            if (onMessageChange) onMessageChange(errorMessage)
          }
        })
      } else if (paymentIntent) {
        // Cas 3DS abandonné ou autre statut non-succeeded (requires_action, requires_payment_method, canceled)
        // Notifier le backend pour mettre à jour le statut
        console.log(`⚠️ Paiement non confirmé, statut: ${paymentIntent.status}`)
        confirmPayment(paymentIntent.id, billingData).catch(() => {})

        onTrackingEvent?.('payment-failed', {
          timestamp: new Date().toISOString(),
          checkoutId,
          status: paymentIntent.status
        })

        const errorMessage = 'Payment was not completed. Please try again.'
        setMessage(errorMessage)
        if (onMessageChange) onMessageChange(errorMessage)
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setMessage(errorMessage)
      if (onMessageChange) onMessageChange(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = stripe && elements && !isLoading && !isPending

  // Utiliser useRef pour tracker si on a déjà envoyé l'événement payment-info-started
  const hasTrackedPaymentStarted = useRef(false)

  // Fonctions pour gérer les événements des éléments Stripe
  const handleElementChange = (elementType: 'cardNumber' | 'cardExpiry' | 'cardCvc') => (event: { empty: boolean; complete: boolean; error: unknown }) => {
    const setState = elementType === 'cardNumber' ? setCardNumberState : 
                     elementType === 'cardExpiry' ? setCardExpiryState : setCardCvcState
    
    setState(prev => ({
      ...prev,
      empty: event.empty,
      complete: event.complete,
      error: event.error
    }))
    
    // Track la première fois que l'utilisateur commence à taper dans les champs de paiement
    if (!hasTrackedPaymentStarted.current && !event.empty) {
      hasTrackedPaymentStarted.current = true
      onTrackingEvent?.('payment-info-started', {
        timestamp: new Date().toISOString(),
        checkoutId,
        field: elementType
      })
    }
    
    // Track quand tous les champs sont complétés
    const allComplete = (elementType === 'cardNumber' ? event.complete : cardNumberState.complete) &&
                       (elementType === 'cardExpiry' ? event.complete : cardExpiryState.complete) &&
                       (elementType === 'cardCvc' ? event.complete : cardCvcState.complete)
    
    if (allComplete) {
      onTrackingEvent?.('payment-info-completed', {
        timestamp: new Date().toISOString(),
        checkoutId,
        allFieldsComplete: true
      })
    }
  }

  const handleElementFocus = (elementType: 'cardNumber' | 'cardExpiry' | 'cardCvc') => () => {
    const setState = elementType === 'cardNumber' ? setCardNumberState : 
                     elementType === 'cardExpiry' ? setCardExpiryState : setCardCvcState
    
    setState(prev => ({ ...prev, focused: true }))
  }

  const handleElementBlur = (elementType: 'cardNumber' | 'cardExpiry' | 'cardCvc') => () => {
    const setState = elementType === 'cardNumber' ? setCardNumberState : 
                     elementType === 'cardExpiry' ? setCardExpiryState : setCardCvcState
    
    setState(prev => ({ ...prev, focused: false }))
  }

  // Expose handlers to parent component
  useEffect(() => {
    if (onPaymentReady) {
      onPaymentReady({
        handleSubmit,
        isLoading,
        isPending,
        canSubmit: Boolean(canSubmit)
      })
    }
  }, [onPaymentReady, isLoading, isPending, canSubmit])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* <div className="flex justify-between items-center">
          <div className="font-semibold text-gray-800 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
            Carte de crédit/débit
          </div>
          <div className="flex items-center gap-3">
            <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa" className="h-[20px] opacity-80" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-[20px] opacity-80" />
          </div>
        </div> */}
        <div className="flex flex-col gap-4">
          {/* Numéro de carte */}
          <div>
            <div className={`stripe-element-container ${
              cardNumberState.focused ? 'focused' : ''
            } ${
              cardNumberState.empty ? 'empty' : ''
            } ${
              cardNumberState.error ? 'invalid' : ''
            }`}>
              <CardNumberElement
                className="stripe-element"
                options={{
                  style: elementStyles,
                  classes: elementClasses,
                  disableLink: true,
                }}
                onChange={handleElementChange('cardNumber')}
                onFocus={handleElementFocus('cardNumber')}
                onBlur={handleElementBlur('cardNumber')}
              />
              <label className="stripe-element-label">
                Card number
              </label>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {cardNumberState.error && (cardNumberState.error as any).message && (
              <div className="stripe-element-error">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(cardNumberState.error as any).message}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {/* Date d'expiration */}
            <div className="flex-1">
              <div className={`stripe-element-container ${
                cardExpiryState.focused ? 'focused' : ''
              } ${
                cardExpiryState.empty ? 'empty' : ''
              } ${
                cardExpiryState.error ? 'invalid' : ''
              }`}>
                <CardExpiryElement
                  className="stripe-element"
                  options={{
                    style: elementStyles,
                    classes: elementClasses,
                  }}
                  onChange={handleElementChange('cardExpiry')}
                  onFocus={handleElementFocus('cardExpiry')}
                  onBlur={handleElementBlur('cardExpiry')}
                />
                <label className="stripe-element-label">
                  MM/YY
                </label>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {cardExpiryState.error && (cardExpiryState.error as any).message && (
                <div className="stripe-element-error">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(cardExpiryState.error as any).message}
                </div>
              )}
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
                <CardCvcElement
                  className="stripe-element"
                  options={{
                    style: elementStyles,
                    classes: elementClasses,
                  }}
                  onChange={handleElementChange('cardCvc')}
                  onFocus={handleElementFocus('cardCvc')}
                  onBlur={handleElementBlur('cardCvc')}
                />
                <label className="stripe-element-label">
                  CVC
                </label>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {cardCvcState.error && (cardCvcState.error as any).message && (
                <div className="stripe-element-error">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(cardCvcState.error as any).message}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      
    </form>
  )
}
