'use client'

import { useState, useEffect, useRef } from 'react'
import countries from "i18n-iso-countries"
import { ChevronDown, AlertCircle, CheckCircle, Check } from 'lucide-react'
import { StripeProvider } from '@/components/stripe-provider'
import { PaymentForm } from '@/components/payment-form'
import { ExpressCheckout } from '@/components/express-checkout'
import { useCheckoutTracking } from '@/lib/use-checkout-tracking'
import { useTranslations, useFormattedTranslation } from '@/components/translations-provider'
import type { Cart } from '@/lib/types'
import * as pixel from '@/lib/fpixel'
import * as ttqpixel from '@/lib/ttqpixel'
import FacebookPixel from '@/components/facebook-pixel'
import TiktokPixel from '@/components/tiktok-pixel'
import {
  emailSchema,
  phoneSchema,
  addressSchema,
  citySchema,
  postalCodeSchema,
  countrySchema,
  validateField
} from '@/lib/validation-schemas'

// Countries library will be initialized in the component based on locale

// Helper function to add business days to a date
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let addedDays = 0
  while (addedDays < days) {
    result.setDate(result.getDate() + 1)
    const dayOfWeek = result.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      addedDays++
    }
  }
  return result
}

// Format date in locale-specific format (e.g., "jeu. 28 nov." in French)
function formatDeliveryDate(date: Date): string {
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

// Format shipping subtitle with date variables
function formatShippingSubtitle(template: string | null | undefined, minDays: number, maxDays: number): string {
  const defaultTemplate = 'Entre le {{minDate}} et le {{maxDate}}' // This will be replaced by ft() call later
  const text = template || defaultTemplate
  const minDate = formatDeliveryDate(addBusinessDays(new Date(), minDays))
  const maxDate = formatDeliveryDate(addBusinessDays(new Date(), maxDays))
  return text.replace('{{minDate}}', minDate).replace('{{maxDate}}', maxDate)
}

// Shopify-style input component - defined outside to prevent re-creation on state changes
const ShopifyInput = ({
  id,
  name,
  label,
  type = 'text',
  required = false,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  className = ''
}: {
  id: string
  name: string
  label: string
  type?: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  error?: string
  autoComplete?: string
  className?: string
}) => (
  <div className={`relative ${className}`}>
    <div className={`relative border rounded-lg bg-white transition-all ${
      error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400 focus-within:border-black focus-within:ring-1 focus-within:ring-black'
    }`}>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete={autoComplete}
        placeholder=" "
        className="peer w-full px-3 pt-5 pb-2 text-sm bg-transparent outline-none placeholder-transparent"
      />
      <label
        htmlFor={id}
        className={`absolute left-3 transition-all pointer-events-none
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm
          peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-xs
          ${value ? 'top-2 -translate-y-0 text-xs' : 'top-1/2 -translate-y-1/2 text-sm'}
          ${error ? 'text-red-500' : 'text-gray-500'}`}
      >
        {label}
      </label>
    </div>
    {error && (
      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
)

// Shopify-style select component - defined outside to prevent re-creation on state changes
const ShopifySelect = ({
  id,
  name,
  label,
  required = false,
  value,
  onChange,
  onBlur,
  error,
  children,
  className = ''
}: {
  id: string
  name: string
  label: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: () => void
  error?: string
  children: React.ReactNode
  className?: string
}) => (
  <div className={`relative ${className}`}>
    <div className={`relative border rounded-lg bg-white transition-all ${
      error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400 focus-within:border-black focus-within:ring-1 focus-within:ring-black'
    }`}>
      <select
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className="peer w-full px-3 pt-5 pb-2 text-sm bg-transparent outline-none appearance-none cursor-pointer"
      >
        {children}
      </select>
      <label
        htmlFor={id}
        className={`absolute left-3 top-2 text-xs pointer-events-none ${error ? 'text-red-500' : 'text-gray-500'}`}
      >
        {label}
      </label>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
    {error && (
      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
)

// Shopify-style checkbox component - defined outside to prevent re-creation on state changes
const ShopifyCheckbox = ({
  id,
  checked,
  onChange,
  label,
  className = ''
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  className?: string
}) => (
  <label htmlFor={id} className={`flex items-center gap-3 cursor-pointer group ${className}`}>
    <div className="relative flex-shrink-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className={`
        w-[18px] h-[18px] rounded border transition-all duration-150
        flex items-center justify-center
        ${checked
          ? 'bg-black border-black'
          : 'bg-white border-gray-300 group-hover:border-gray-400'
        }
        peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2
      `}>
        {checked && (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </div>
    </div>
    <span className="text-sm text-gray-700 leading-tight select-none">{label}</span>
  </label>
)

interface CheckoutClientProps {
  cart: Cart
  store?: {
    id: string
    name: string
    domain: string
    logoUrl?: string
    supportEmail?: string
    requiresShipping?: boolean
    metaPixelId?: string | null
    tiktokPixelId?: string | null
    // Address section title (e.g., "Livraison" or "Facturation")
    addressSectionTitle?: string | null
    // Shipping display config
    shippingMethodTitle?: string | null
    shippingMethodSubtitle?: string | null
    shippingMinDays?: number
    shippingMaxDays?: number
    // Shipping method image
    shippingDisplayType?: string | null // "icon" (left of text) or "logo" (right, replaces "Gratuit")
    shippingImageUrl?: string | null
    // Trust badges (icon can be emoji or image URL)
    trustBadges?: Array<{ icon: string; imageUrl?: string; title: string; subtitle: string }> | null
    // Trustpilot widget config
    trustpilotEnabled?: boolean
    trustpilotRating?: number | null
    trustpilotReviewCount?: number | null
    trustpilotUrl?: string | null
  }
  checkoutId: string
  publishableKey?: string
}

export default function CheckoutClient({ cart, store, checkoutId, publishableKey: initialPublishableKey }: CheckoutClientProps) {
  // Hook de tracking des événements de checkout
  const tracking = useCheckoutTracking({ checkoutId })
  
  // Hooks de traduction
  const { t, locale } = useTranslations()
  const ft = useFormattedTranslation()

  // Initialize countries library based on locale
  useEffect(() => {
    try {
      if (locale === 'fr') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/fr.json"))
      } else if (locale === 'en') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/en.json"))
      } else if (locale === 'es') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/es.json"))
      } else if (locale === 'he') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/he.json"))
      } else if (locale === 'it') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/it.json"))
      } else {
        // Default to English for other locales
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        countries.registerLocale(require("i18n-iso-countries/langs/en.json"))
      }
    } catch (error) {
      console.warn('Failed to load country translations:', error)
    }
  }, [locale])

  const lastTrackedState = useRef<string>('')

  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false)
  const [publishableKey, setPublishableKey] = useState<string | undefined>(initialPublishableKey)
  const [isExpressCheckoutAvailable, setIsExpressCheckoutAvailable] = useState(false)
  const [addressData, setAddressData] = useState({
    fullAddress: '',
    line2: '',
    city: '',
    postalCode: '',
    country: 'FR',
    state: ''
  })
  const [customerData, setCustomerData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  })

  // États d'erreur pour la validation
  const [errors, setErrors] = useState<{
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    fullAddress?: string
    line2?: string
    city?: string
    postalCode?: string
    country?: string
    state?: string
  }>({})

  const [touched, setTouched] = useState<{
    email: boolean
    firstName: boolean
    lastName: boolean
    phone: boolean
    fullAddress: boolean
    line2: boolean
    city: boolean
    postalCode: boolean
    country: boolean
    state: boolean
  }>({
    email: false,
    firstName: false,
    lastName: false,
    phone: false,
    fullAddress: false,
    line2: false,
    city: false,
    postalCode: false,
    country: false,
    state: false
  })

  const [paymentHandlers, setPaymentHandlers] = useState<{
    handleSubmit: (e: React.FormEvent<Element>) => void
    isLoading: boolean
    isPending: boolean
    canSubmit: boolean
  } | null>(null)
  const [paymentMessage, setPaymentMessage] = useState<string>('')
  const [useSameAddress, setUseSameAddress] = useState(true)
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  // État pour l'adresse de facturation
  const [billingData, setBillingData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    address: '',
    line2: '',
    city: '',
    postalCode: '',
    country: 'FR',
    phone: ''
  })

  // Fonctions de validation
  const validateEmail = (email: string) => {
    const result = validateField(emailSchema, email)
    if (result.success) {
      setErrors(prev => ({ ...prev, email: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, email: result.error }))
      return false
    }
  }

  const validateFirstName = (name: string) => {
    if (!name || name.trim().length < 1) {
      setErrors(prev => ({ ...prev, firstName: t('checkout.validation.firstNameRequired') }))
      return false
    }
    setErrors(prev => ({ ...prev, firstName: undefined }))
    return true
  }

  const validateLastName = (name: string) => {
    if (!name || name.trim().length < 1) {
      setErrors(prev => ({ ...prev, lastName: t('checkout.validation.lastNameRequired') }))
      return false
    }
    setErrors(prev => ({ ...prev, lastName: undefined }))
    return true
  }

  const validatePhone = (phone: string) => {
    const result = validateField(phoneSchema, phone)
    if (result.success) {
      setErrors(prev => ({ ...prev, phone: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, phone: result.error }))
      return false
    }
  }

  const validateAddress = (address: string) => {
    const result = validateField(addressSchema, address)
    if (result.success) {
      setErrors(prev => ({ ...prev, fullAddress: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, fullAddress: result.error }))
      return false
    }
  }

  const validateCity = (city: string) => {
    const result = validateField(citySchema, city)
    if (result.success) {
      setErrors(prev => ({ ...prev, city: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, city: result.error }))
      return false
    }
  }

  const validatePostalCode = (postalCode: string) => {
    const result = validateField(postalCodeSchema, postalCode)
    if (result.success) {
      setErrors(prev => ({ ...prev, postalCode: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, postalCode: result.error }))
      return false
    }
  }

  const validateCountry = (country: string) => {
    const result = validateField(countrySchema, country)
    if (result.success) {
      setErrors(prev => ({ ...prev, country: undefined }))
      return true
    } else {
      setErrors(prev => ({ ...prev, country: result.error }))
      return false
    }
  }

  // Fonction pour marquer un champ comme touché
  const handleFieldBlur = (fieldName: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }

  // Surveiller les changements de states pour tracker les événements
  useEffect(() => {
    const currentFields = {
      email: !!customerData.email,
      firstName: !!customerData.firstName,
      lastName: !!customerData.lastName,
      address: !!addressData.fullAddress,
      city: !!addressData.city,
      postalCode: !!addressData.postalCode,
      country: !!addressData.country,
      phone: !!customerData.phone,
      line2: !!addressData.line2
    }

    const hasStartedFilling = Object.values(currentFields).some(field => field)

    const allFieldsFilled = store?.requiresShipping === false
      ? customerData.email
      : customerData.email &&
        customerData.firstName &&
        customerData.lastName &&
        addressData.fullAddress &&
        addressData.city &&
        addressData.postalCode &&
        addressData.country

    if (hasStartedFilling) {
      const currentStateHash = JSON.stringify(currentFields)

      if (currentStateHash !== lastTrackedState.current) {
        lastTrackedState.current = currentStateHash
        tracking.trackCustomerInfoProgress({
          timestamp: new Date().toISOString(),
          formType: 'customer-info',
          fieldsStarted: currentFields,
          totalFieldsFilled: Object.values(currentFields).filter(Boolean).length
        })
      }
    }

    if (allFieldsFilled) {
      tracking.trackCustomerInfoEntered({
        timestamp: new Date().toISOString(),
        formType: 'customer-info',
        fieldsCompleted: currentFields
      })
    }
  }, [customerData, addressData, tracking, store?.requiresShipping])

  // Fonction pour valider tous les champs requis
  const validateAllFields = () => {
    const emailValid = validateEmail(customerData.email)

    if (store?.requiresShipping === false) {
      return emailValid
    }

    const firstNameValid = validateFirstName(customerData.firstName)
    const lastNameValid = validateLastName(customerData.lastName)
    const addressValid = validateAddress(addressData.fullAddress)
    const cityValid = validateCity(addressData.city)
    const postalCodeValid = validatePostalCode(addressData.postalCode)
    const countryValid = validateCountry(addressData.country)

    const phoneValid = customerData.phone ? validatePhone(customerData.phone) : true

    return emailValid && firstNameValid && lastNameValid && addressValid && cityValid && postalCodeValid && countryValid && phoneValid
  }

  // Get all country names in the current locale
  const countryNames = countries.getNames(locale)
  const countryList = Object.entries(countryNames).map(([code, name]) => ({
    code,
    name
  })).sort((a, b) => {
    if (a.code === 'FR') return -1
    if (b.code === 'FR') return 1
    return a.name.localeCompare(b.name)
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as { checkoutId?: string }).checkoutId = checkoutId
    }
  }, [checkoutId])

  // Protection contre les envois multiples d'InitiateCheckout
  const hasSentInitiateCheckout = useRef(false)

  // Envoyer l'événement InitiateCheckout au Meta Pixel et TikTok Pixel (une seule fois)
  useEffect(() => {
    if (cart && cart.items && !hasSentInitiateCheckout.current) {
      const contentIds = cart.items.map(item => item.productId || item.variantId || item.id)
      const contents = cart.items.map(item => ({
        id: item.productId || item.variantId || item.id,
        quantity: item.quantity,
        item_price: item.unitPrice
      }))
      const numItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)

      // Meta Pixel - InitiateCheckout
      pixel.initiateCheckout({
        value: cart.totalAmount,
        currency: cart.currency,
        content_ids: contentIds,
        content_type: 'product',
        contents: contents,
        num_items: numItems
      })

      // TikTok Pixel - InitiateCheckout
      const tiktokContents = cart.items.map(item => ({
        content_id: item.productId || item.variantId || item.id,
        quantity: item.quantity,
        price: item.unitPrice
      }))

      ttqpixel.initiateCheckout({
        value: cart.totalAmount,
        currency: cart.currency,
        content_type: 'product',
        quantity: numItems,
        contents: tiktokContents
      })

      hasSentInitiateCheckout.current = true
    }
  }, [cart])

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price)
  }

  return (
    <>
      <FacebookPixel pixelId={store?.metaPixelId} />
      <TiktokPixel pixelId={store?.tiktokPixelId} />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          {/* Mobile Header */}
          <div className="lg:hidden px-4 sm:px-6 py-4 flex items-center justify-between">
            <a
              href={store?.domain ? `https://${store.domain}` : '#'}
              className="flex items-center"
            >
              {store?.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store?.name || 'Store'}
                  className="h-10 max-w-[120px] object-contain"
                />
              ) : (
                <span className="text-lg font-semibold text-gray-900">{store?.name}</span>
              )}
            </a>
            <a
              href={store?.domain ? `https://${store.domain}/cart` : '#'}
              className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
              aria-label={t('checkout.cart')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" focusable="false" aria-hidden="true" className="w-6 h-6 fill-none stroke-current">
                <path d="m2.007 10.156.387-4.983a1 1 0 0 1 .997-.923h7.218a1 1 0 0 1 .997.923l.387 4.983c.11 1.403-1.16 2.594-2.764 2.594H4.771c-1.605 0-2.873-1.19-2.764-2.594" />
                <path d="M5 3.5c0-1.243.895-2.25 2-2.25S9 2.257 9 3.5V5c0 1.243-.895 2.25-2 2.25S5 6.243 5 5z" />
              </svg>
            </a>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center">
            {/* Left side - Logo */}
            <div className="lg:w-1/2">
              <div className="max-w-[550px] ml-auto px-4 sm:px-6 lg:px-10 lg:pr-12 py-4">
                <a
                  href={store?.domain ? `https://${store.domain}` : '#'}
                  className="flex items-center"
                >
                  {store?.logoUrl ? (
                    <img
                      src={store.logoUrl}
                      alt={store?.name || 'Store'}
                      className="h-10 max-w-[120px] object-contain"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-gray-900">{store?.name}</span>
                  )}
                </a>
              </div>
            </div>

            {/* Right side - Cart Icon */}
            <div className="lg:w-1/2">
              <div className="w-full max-w-[450px] px-6 lg:px-10 lg:pl-12 py-4 flex justify-end">
                <a
                  href={store?.domain ? `https://${store.domain}/cart` : '#'}
                  className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
                  aria-label={t('checkout.cart')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" focusable="false" aria-hidden="true" className="w-6 h-6 fill-none stroke-current">
                    <path d="m2.007 10.156.387-4.983a1 1 0 0 1 .997-.923h7.218a1 1 0 0 1 .997.923l.387 4.983c.11 1.403-1.16 2.594-2.764 2.594H4.771c-1.605 0-2.873-1.19-2.764-2.594" />
                    <path d="M5 3.5c0-1.243.895-2.25 2-2.25S9 2.257 9 3.5V5c0 1.243-.895 2.25-2 2.25S5 6.243 5 5z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Order Summary - Top collapsible */}
        <aside className="lg:hidden bg-[#f6f6f6]">
          <button
            onClick={() => setIsOrderSummaryOpen(!isOrderSummaryOpen)}
            aria-controls="mobile-order-summary"
            aria-expanded={isOrderSummaryOpen}
            type="button"
            className="w-full px-5 py-4 flex items-center justify-between border-b border-[#e0e0e0]"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm text-gray-900">{t('checkout.title')}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 14 14"
                focusable="false"
                aria-hidden="true"
                className={`w-3.5 h-3.5 text-gray-900 fill-none stroke-current transition-transform duration-200 ${isOrderSummaryOpen ? '' : 'rotate-180'}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m2 9.25 4.646-4.646a.5.5 0 0 1 .708 0L12 9.25" />
              </svg>
            </span>
            <strong className="text-base text-gray-900">{formatPrice(cart.totalAmount, cart.currency)}</strong>
          </button>

          {/* Expandable content */}
          <div
            id="mobile-order-summary"
            className={`overflow-hidden transition-all duration-200 ease-in-out ${isOrderSummaryOpen ? 'max-h-[80vh] overflow-y-auto' : 'max-h-0'}`}
          >
            <div className="px-5 pt-4 pb-5 border-b border-[#e0e0e0]">
              {/* Section Header */}
              <h2 className="sr-only">{t('checkout.orderSummary')}</h2>

              {/* Panier Section */}
              <section className="mb-4">
                <h3 className="sr-only">{t('checkout.cart')}</h3>
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      {/* Product Image */}
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[8px] border-2 border-white overflow-hidden">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100" />
                          )}
                        </div>
                        <div className="absolute -top-[6px] -right-[6px] w-[22px] h-[22px] bg-black text-white text-xs rounded-[6px] flex items-center justify-center font-medium border-2 border-white">
                          <span className="sr-only">{t('checkout.quantity')}</span>
                          <span aria-hidden="true">{item.quantity}</span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        {item.variantTitle && item.variantTitle.toLowerCase() !== 'default title' && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.variantTitle}</p>
                        )}
                      </div>

                      {/* Quantity - hidden visually */}
                      <span className="sr-only">{item.quantity}</span>

                      {/* Price */}
                      <span className="text-sm text-gray-900 flex-shrink-0">{formatPrice(item.totalPrice, cart.currency)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Résumé des coûts */}
              <section>
                <h3 className="sr-only">{t('checkout.costSummary')}</h3>
                <div className="space-y-3 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900">{t('checkout.subtotal')}</span>
                    <span className="text-gray-900">{formatPrice(cart.subtotal, cart.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900">{t('checkout.shipping')}</span>
                    <span className="text-gray-900">{t('checkout.free')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <strong className="text-base text-gray-900">{t('checkout.total')}</strong>
                    <div className="flex items-center gap-2">
                      <abbr title={cart.currency.toUpperCase()} className="text-xs text-gray-500 no-underline">{cart.currency.toUpperCase()}</abbr>
                      <strong className="text-base text-gray-900">{formatPrice(cart.totalAmount, cart.currency)}</strong>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </aside>

        {/* Main Layout with full-width background - centered divider */}
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
          {/* Left Column - Main Form (white background, 50% width) */}
          <div className="lg:w-1/2 bg-white">
            <div className="max-w-[550px] ml-auto px-4 sm:px-6 lg:px-10 lg:pr-12 py-6 lg:py-10">

              {/* Express Checkout - Apple Pay / Google Pay */}
              {publishableKey && (
                <section className={isExpressCheckoutAvailable ? 'mb-2' : ''}>
                  {isExpressCheckoutAvailable && (
                    <div className="text-center mb-3">
                      <h3 className="text-sm text-gray-500">{t('checkout.expressPayment')}</h3>
                    </div>
                  )}
                  <StripeProvider
                    publishableKey={publishableKey}
                    amount={cart.totalAmount}
                    currency={cart.currency}
                  >
                    <ExpressCheckout
                      checkoutId={checkoutId}
                      amount={cart.totalAmount}
                      requiresShipping={store?.requiresShipping !== false}
                      storeData={store ? {
                        id: store.id,
                        name: store.name,
                        domain: store.domain,
                        logoUrl: store.logoUrl,
                        supportEmail: store.supportEmail,
                        requiresShipping: store.requiresShipping,
                        shippingMethodTitle: store.shippingMethodTitle,
                        platform: 'SHOPIFY'
                      } : undefined}
                      onAvailabilityChange={setIsExpressCheckoutAvailable}
                      onTrackingEvent={(event) => {
                        switch (event) {
                          case 'express-payment-attempted':
                            tracking.trackPaymentAttempted()
                            break
                          case 'express-payment-successful':
                            tracking.trackPaymentSuccessful()
                            break
                          case 'express-payment-failed':
                            tracking.trackPaymentFailed()
                            break
                        }
                      }}
                    />
                  </StripeProvider>
                </section>
              )}

              {/* OR Separator - Only visible if express checkout is available */}
              {isExpressCheckoutAvailable && (
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm text-gray-500 font-medium">{t('checkout.or')}</span>
                  </div>
                </div>
              )}

              {/* Contact Section */}
              <section className="mb-8">
                <h2 className="text-[21px] font-semibold text-gray-900 mb-4">{t('checkout.contact')}</h2>

                <ShopifyInput
                  id="email"
                  name="email"
                  label={t('checkout.emailLabel')}
                  type="email"
                  required
                  value={customerData.email}
                  onChange={(e) => {
                    setCustomerData(prev => ({ ...prev, email: e.target.value }))
                    validateEmail(e.target.value)
                  }}
                  onBlur={() => handleFieldBlur('email')}
                  error={touched.email ? errors.email : undefined}
                  autoComplete="email"
                />

                <ShopifyCheckbox
                  id="marketingOptIn"
                  checked={marketingOptIn}
                  onChange={setMarketingOptIn}
                  label={t('checkout.marketingOptIn')}
                  className="mt-4"
                />
              </section>

              {/* Delivery Section */}
              {store?.requiresShipping !== false && (
                <section className="mb-8">
                  <h2 className="text-[21px] font-semibold text-gray-900 mb-4">{store?.addressSectionTitle || t('checkout.delivery')}</h2>

                  <div className="space-y-3">
                    {/* Country Select */}
                    <ShopifySelect
                      id="country"
                      name="countryCode"
                      label={t('checkout.countryLabel')}
                      required
                      value={addressData.country}
                      onChange={(e) => {
                        setAddressData(prev => ({ ...prev, country: e.target.value }))
                        validateCountry(e.target.value)
                      }}
                      onBlur={() => handleFieldBlur('country')}
                      error={touched.country ? errors.country : undefined}
                    >
                      {countryList.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </ShopifySelect>

                    {/* First Name / Last Name */}
                    <div className="grid grid-cols-2 gap-3">
                      <ShopifyInput
                        id="firstName"
                        name="firstName"
                        label={t('checkout.firstNameLabel')}
                        required
                        value={customerData.firstName}
                        onChange={(e) => {
                          setCustomerData(prev => ({ ...prev, firstName: e.target.value }))
                          validateFirstName(e.target.value)
                        }}
                        onBlur={() => handleFieldBlur('firstName')}
                        error={touched.firstName ? errors.firstName : undefined}
                        autoComplete="given-name"
                      />
                      <ShopifyInput
                        id="lastName"
                        name="lastName"
                        label={t('checkout.lastNameLabel')}
                        required
                        value={customerData.lastName}
                        onChange={(e) => {
                          setCustomerData(prev => ({ ...prev, lastName: e.target.value }))
                          validateLastName(e.target.value)
                        }}
                        onBlur={() => handleFieldBlur('lastName')}
                        error={touched.lastName ? errors.lastName : undefined}
                        autoComplete="family-name"
                      />
                    </div>

                    {/* Address */}
                    <ShopifyInput
                      id="address"
                      name="address1"
                      label={t('checkout.addressLabel')}
                      required
                      value={addressData.fullAddress}
                      onChange={(e) => {
                        setAddressData(prev => ({ ...prev, fullAddress: e.target.value }))
                        validateAddress(e.target.value)
                      }}
                      onBlur={() => handleFieldBlur('fullAddress')}
                      error={touched.fullAddress ? errors.fullAddress : undefined}
                      autoComplete="street-address"
                    />

                    {/* Address Line 2 */}
                    <ShopifyInput
                      id="line2"
                      name="address2"
                      label={t('checkout.addressLine2Label')}
                      value={addressData.line2}
                      onChange={(e) => {
                        setAddressData(prev => ({ ...prev, line2: e.target.value }))
                      }}
                      onBlur={() => handleFieldBlur('line2')}
                      autoComplete="address-line2"
                    />

                    {/* Postal Code / City */}
                    <div className="grid grid-cols-2 gap-3">
                      <ShopifyInput
                        id="postalCode"
                        name="postalCode"
                        label={t('checkout.postalCodeLabel')}
                        required
                        value={addressData.postalCode}
                        onChange={(e) => {
                          setAddressData(prev => ({ ...prev, postalCode: e.target.value }))
                          validatePostalCode(e.target.value)
                        }}
                        onBlur={() => handleFieldBlur('postalCode')}
                        error={touched.postalCode ? errors.postalCode : undefined}
                        autoComplete="postal-code"
                      />
                      <ShopifyInput
                        id="city"
                        name="city"
                        label={t('checkout.cityLabel')}
                        required
                        value={addressData.city}
                        onChange={(e) => {
                          setAddressData(prev => ({ ...prev, city: e.target.value }))
                          validateCity(e.target.value)
                        }}
                        onBlur={() => handleFieldBlur('city')}
                        error={touched.city ? errors.city : undefined}
                        autoComplete="address-level2"
                      />
                    </div>

                    {/* Phone */}
                    <ShopifyInput
                      id="phone"
                      name="phone"
                      label={t('checkout.phoneLabel')}
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => {
                        setCustomerData(prev => ({ ...prev, phone: e.target.value }))
                        if (e.target.value) validatePhone(e.target.value)
                        else setErrors(prev => ({ ...prev, phone: undefined }))
                      }}
                      onBlur={() => handleFieldBlur('phone')}
                      error={touched.phone ? errors.phone : undefined}
                      autoComplete="tel"
                    />
                  </div>

                  {/* Shipping Method */}
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">{t('checkout.shippingMethod')}</h3>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-300 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-[18px] h-[18px] rounded-full border-[5px] border-black bg-white" />
                        {store?.shippingDisplayType === 'icon' && store?.shippingImageUrl && (
                          <img src={store.shippingImageUrl} alt="" className="w-6 h-6 object-contain" />
                        )}
                        <div>
                          <p className="text-sm text-gray-900">{store?.shippingMethodTitle || t('checkout.standardDelivery')}</p>
                          <p className="text-xs text-gray-500">
                            {store?.shippingMethodSubtitle
                              ? formatShippingSubtitle(store.shippingMethodSubtitle, store?.shippingMinDays ?? 1, store?.shippingMaxDays ?? 2)
                              : ft('checkout.deliveryEstimate', {
                                  minDate: formatDeliveryDate(addBusinessDays(new Date(), store?.shippingMinDays ?? 1)),
                                  maxDate: formatDeliveryDate(addBusinessDays(new Date(), store?.shippingMaxDays ?? 2))
                                })
                            }
                          </p>
                        </div>
                      </div>
                      {store?.shippingDisplayType === 'logo' && store?.shippingImageUrl ? (
                        <img src={store.shippingImageUrl} alt="" className="h-6 max-w-[120px] object-contain" />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{t('checkout.free')}</span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Payment Section */}
              <section className="mb-8">
                <h2 className="text-[21px] font-semibold text-gray-900 mb-2">{t('checkout.payment')}</h2>
                <p className="text-sm text-gray-500 mb-4">{t('checkout.secureTransactions')}</p>

                {paymentMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm border ${
                    paymentMessage.includes('réussi')
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {paymentMessage.includes('réussi') ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      {paymentMessage}
                    </div>
                  </div>
                )}

                {publishableKey ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Credit Card Header */}
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{t('checkout.creditCard')}</span>
                        <div className="flex items-center gap-2">
                          <img src="https://cdn.shopify.com/shopifycloud/checkout-web/assets/c1/assets/visa.sxIq5Dot.svg" alt="Visa" className="h-6" />
                          <img src="https://cdn.shopify.com/shopifycloud/checkout-web/assets/c1/assets/mastercard.1c4_lyMp.svg" alt="Mastercard" className="h-6" />
                          <img src="https://cdn.shopify.com/shopifycloud/checkout-web/assets/c1/assets/amex.Csr7hRoy.svg" alt="Amex" className="h-6" />
                        </div>
                      </div>
                    </div>

                    {/* Credit Card Form */}
                    <div className="p-4 bg-white">
                      <StripeProvider
                        clientSecret={undefined}
                        publishableKey={publishableKey}
                      >
                        <PaymentForm
                          clientSecret={undefined}
                          paymentIntentId={undefined}
                          amount={cart.totalAmount}
                          checkoutId={checkoutId}
                          customerData={{
                            email: customerData.email,
                            name: useSameAddress
                              ? `${customerData.firstName} ${customerData.lastName}`.trim()
                              : `${billingData.firstName} ${billingData.lastName}`.trim(),
                            phone: useSameAddress ? customerData.phone : billingData.phone,
                            address: useSameAddress ? {
                              line1: addressData.fullAddress,
                              line2: addressData.line2,
                              city: addressData.city,
                              postal_code: addressData.postalCode,
                              country: addressData.country,
                              state: addressData.state,
                            } : {
                              line1: billingData.address,
                              line2: billingData.line2,
                              city: billingData.city,
                              postal_code: billingData.postalCode,
                              country: billingData.country,
                              state: '',
                            }
                          }}
                          storeData={store ? {
                            id: store.id,
                            name: store.name,
                            domain: store.domain,
                            logoUrl: store.logoUrl,
                            supportEmail: store.supportEmail,
                            requiresShipping: store.requiresShipping,
                            platform: 'SHOPIFY'
                          } : undefined}
                          onPaymentReady={setPaymentHandlers}
                          onReinitStripe={(p) => {
                            // Lors d'un retry, on met à jour la publishableKey pour remount Elements avec le nouveau PSP
                            setPublishableKey(p.publishableKey)
                          }}
                          onMessageChange={setPaymentMessage}
                          onTrackingEvent={(event, metadata) => {
                            switch (event) {
                              case 'payment-info-started':
                                tracking.trackPaymentInfoStarted(metadata)
                                break
                              case 'payment-info-completed':
                                tracking.trackPaymentInfoCompleted(metadata)
                                break
                              case 'payment-attempted':
                                tracking.trackPaymentAttempted(metadata)
                                break
                              case 'payment-successful':
                                tracking.trackPaymentSuccessful(metadata)
                                break
                              case 'payment-failed':
                                tracking.trackPaymentFailed(metadata)
                                break
                            }
                          }}
                        />
                      </StripeProvider>

                      {/* Use same address checkbox */}
                      <ShopifyCheckbox
                        id="useSameAddress"
                        checked={useSameAddress}
                        onChange={setUseSameAddress}
                        label={t('checkout.useSameAddress')}
                        className="mt-4"
                      />

                      {/* Billing Address Form - Expandable */}
                      {!useSameAddress && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="text-sm font-medium text-gray-900 mb-4">{t('checkout.billingAddress')}</h3>
                          <div className="space-y-3">
                            {/* Country Select */}
                            <ShopifySelect
                              id="billingCountry"
                              name="billingCountryCode"
                              label={t('checkout.countryLabel')}
                              required
                              value={billingData.country}
                              onChange={(e) => setBillingData(prev => ({ ...prev, country: e.target.value }))}
                            >
                              {countryList.map((country) => (
                                <option key={country.code} value={country.code}>
                                  {country.name}
                                </option>
                              ))}
                            </ShopifySelect>

                            {/* First Name / Last Name */}
                            <div className="grid grid-cols-2 gap-3">
                              <ShopifyInput
                                id="billingFirstName"
                                name="billingFirstName"
                                label={t('checkout.firstNameLabel')}
                                required
                                value={billingData.firstName}
                                onChange={(e) => setBillingData(prev => ({ ...prev, firstName: e.target.value }))}
                                autoComplete="billing given-name"
                              />
                              <ShopifyInput
                                id="billingLastName"
                                name="billingLastName"
                                label={t('checkout.lastNameLabel')}
                                required
                                value={billingData.lastName}
                                onChange={(e) => setBillingData(prev => ({ ...prev, lastName: e.target.value }))}
                                autoComplete="billing family-name"
                              />
                            </div>

                            {/* Company */}
                            <ShopifyInput
                              id="billingCompany"
                              name="billingCompany"
                              label={t('checkout.companyLabel')}
                              value={billingData.company}
                              onChange={(e) => setBillingData(prev => ({ ...prev, company: e.target.value }))}
                              autoComplete="billing organization"
                            />

                            {/* Address */}
                            <ShopifyInput
                              id="billingAddress"
                              name="billingAddress1"
                              label={t('checkout.addressLabel')}
                              required
                              value={billingData.address}
                              onChange={(e) => setBillingData(prev => ({ ...prev, address: e.target.value }))}
                              autoComplete="billing street-address"
                            />

                            {/* Address Line 2 */}
                            <ShopifyInput
                              id="billingLine2"
                              name="billingAddress2"
                              label={t('checkout.addressLine2Label')}
                              value={billingData.line2}
                              onChange={(e) => setBillingData(prev => ({ ...prev, line2: e.target.value }))}
                              autoComplete="billing address-line2"
                            />

                            {/* Postal Code / City */}
                            <div className="grid grid-cols-2 gap-3">
                              <ShopifyInput
                                id="billingPostalCode"
                                name="billingPostalCode"
                                label={t('checkout.postalCodeLabel')}
                                required
                                value={billingData.postalCode}
                                onChange={(e) => setBillingData(prev => ({ ...prev, postalCode: e.target.value }))}
                                autoComplete="billing postal-code"
                              />
                              <ShopifyInput
                                id="billingCity"
                                name="billingCity"
                                label={t('checkout.cityLabel')}
                                required
                                value={billingData.city}
                                onChange={(e) => setBillingData(prev => ({ ...prev, city: e.target.value }))}
                                autoComplete="billing address-level2"
                              />
                            </div>

                            {/* Phone */}
                            <ShopifyInput
                              id="billingPhone"
                              name="billingPhone"
                              label={t('checkout.phoneOptionalLabel')}
                              type="tel"
                              value={billingData.phone}
                              onChange={(e) => setBillingData(prev => ({ ...prev, phone: e.target.value }))}
                              autoComplete="billing tel"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <p className="text-sm text-yellow-800">
                      {t('checkout.paymentNotAvailable')}
                    </p>
                  </div>
                )}
              </section>

              {/* Remember Me Section - Commented out
              <section className="mb-8">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Se souvenir de moi</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <ShopifyCheckbox
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={setRememberMe}
                    label="Sauvegardez mes données pour effectuer des paiements rapidement"
                  />
                </div>

                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <Lock className="w-3 h-3" />
                  <span>Sécurisé et chiffré</span>
                </div>
              </section>
              */}

              {/* Pay Button */}
              <button
                onClick={(e) => {
                  if (!publishableKey) return

                  const isValid = validateAllFields()
                  if (!isValid) {
                    e.preventDefault()
                    setTouched({
                      email: true,
                      firstName: true,
                      lastName: true,
                      phone: true,
                      fullAddress: true,
                      line2: true,
                      city: true,
                      postalCode: true,
                      country: true,
                      state: true
                    })
                    return
                  }

                  // Envoyer l'événement AddPaymentInfo à Meta Pixel
                  if (cart && cart.items) {
                    const contentIds = cart.items.map(item => item.productId || item.variantId || item.id)
                    const contents = cart.items.map(item => ({
                      id: item.productId || item.variantId || item.id,
                      quantity: item.quantity,
                      item_price: item.unitPrice
                    }))
                    const numItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)

                    pixel.addPaymentInfo({
                      value: cart.totalAmount,
                      currency: cart.currency,
                      content_ids: contentIds,
                      content_type: 'product',
                      contents: contents,
                      num_items: numItems
                    })
                  }

                  tracking.trackPayButtonClicked({
                    timestamp: new Date().toISOString(),
                    action: 'pay-button-clicked',
                    validationPassed: true
                  })

                  paymentHandlers?.handleSubmit(e)
                }}
                disabled={paymentHandlers?.isLoading || paymentHandlers?.isPending}
                className="w-full py-4 px-6 bg-black hover:bg-gray-900 text-white font-medium text-base rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {paymentHandlers?.isLoading || paymentHandlers?.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('checkout.processing')}
                  </span>
                ) : (
                  <span>{t('checkout.payNow')}</span>
                )}
              </button>

              {/* Trustpilot Widget (Mobile only) */}
              {store?.trustpilotEnabled && store.trustpilotRating && store.trustpilotReviewCount && (
                <div className="mt-6 lg:hidden">
                  <div className="p-4 border border-[#00b67a]/30 rounded-lg bg-[#f7faf9]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">Excellent</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://s6.imgcdn.dev/Y0VSGH.webp"
                          alt="Trustpilot stars"
                          className="h-6"
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        Noté {store.trustpilotRating} / 5 basé sur{' '}
                        {store.trustpilotUrl ? (
                          <a
                            href={store.trustpilotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-gray-900"
                          >
                            {store.trustpilotReviewCount.toLocaleString('fr-FR')} avis
                          </a>
                        ) : (
                          <span className="underline">{store.trustpilotReviewCount.toLocaleString('fr-FR')} avis</span>
                        )}
                        {' '}sur{' '}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://s6.imgcdn.dev/Y0VGQi.webp"
                          alt="Trustpilot"
                          className="h-5 inline-block align-middle"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trust Badges (Mobile only - below payment button) */}
              {store?.trustBadges && store.trustBadges.length > 0 && (
                <div className="lg:hidden pt-6 border-t border-gray-200 mt-6">
                  <div className="space-y-4">
                    {store.trustBadges.map((badge, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                          {badge.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={badge.imageUrl}
                              alt={badge.title}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <span className="text-2xl">{badge.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{badge.title}</p>
                          <p className="text-sm text-gray-500">{badge.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <footer className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <button className="hover:text-gray-700">{t('checkout.refundPolicy')}</button>
                  <button className="hover:text-gray-700">{t('checkout.privacyPolicy')}</button>
                  <button className="hover:text-gray-700">{t('checkout.termsOfUse')}</button>
                </div>
              </footer>
            </div>
          </div>

          {/* Right Column - Order Summary (Desktop) - 50% width, gray background extends to edge */}
          <aside className="hidden lg:block lg:w-1/2 bg-gray-50 border-l border-gray-200">
            <div className="sticky top-0 p-6 lg:p-10 lg:pl-12 max-w-[450px]">

              {/* Product List */}
              <div className="space-y-4 mb-6">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    {/* Product Image with Quantity Badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-[8px] border-2 border-white overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100" />
                        )}
                      </div>
                      <div className="absolute -top-[6px] -right-[6px] w-[22px] h-[22px] bg-black text-white text-xs rounded-[6px] flex items-center justify-center font-medium border-2 border-white">
                        <span className="sr-only">Quantité</span>
                        <span aria-hidden="true">{item.quantity}</span>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                      {item.variantTitle && item.variantTitle.toLowerCase() !== 'default title' && (
                        <p className="text-xs text-gray-500 mt-1">{item.variantTitle}</p>
                      )}
                    </div>

                    {/* Price */}
                    <span className="text-sm text-gray-900 flex-shrink-0">
                      {formatPrice(item.totalPrice, cart.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Cost Summary */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.subtotal')}</span>
                  <span className="text-gray-900">{formatPrice(cart.subtotal, cart.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.shipping')}</span>
                  <span className="text-gray-900">Gratuit</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-base font-semibold text-gray-900">{t('checkout.total')}</span>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 mr-2">{cart.currency.toUpperCase()}</span>
                    <span className="text-xl font-semibold text-gray-900">{formatPrice(cart.totalAmount, cart.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Trustpilot Widget (Desktop) */}
              {store?.trustpilotEnabled && store.trustpilotRating && store.trustpilotReviewCount && (
                <div className="mt-6">
                  <div className="p-4 border border-[#00b67a]/30 rounded-lg bg-[#f7faf9]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">Excellent</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://s6.imgcdn.dev/Y0VSGH.webp"
                          alt="Trustpilot stars"
                          className="h-6"
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        Noté {store.trustpilotRating} / 5 basé sur{' '}
                        {store.trustpilotUrl ? (
                          <a
                            href={store.trustpilotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-gray-900"
                          >
                            {store.trustpilotReviewCount.toLocaleString('fr-FR')} avis
                          </a>
                        ) : (
                          <span className="underline">{store.trustpilotReviewCount.toLocaleString('fr-FR')} avis</span>
                        )}
                        {' '}sur{' '}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://s6.imgcdn.dev/Y0VGQi.webp"
                          alt="Trustpilot"
                          className="h-5 inline-block align-middle"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trust Badges (Desktop) */}
              {store?.trustBadges && store.trustBadges.length > 0 && (
                <div className="pt-6 border-t border-gray-200 mt-6">
                  <div className="space-y-4">
                    {store.trustBadges.map((badge, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                          {badge.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={badge.imageUrl}
                              alt={badge.title}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <span className="text-2xl">{badge.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{badge.title}</p>
                          <p className="text-sm text-gray-500">{badge.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>
    </>
  )
}
