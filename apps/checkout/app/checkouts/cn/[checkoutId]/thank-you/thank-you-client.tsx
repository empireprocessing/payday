'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, ChevronDown } from 'lucide-react'
import { getOrderData } from '@/lib/actions'
import * as pixel from '@/lib/fpixel'
import * as ttqpixel from '@/lib/ttqpixel'
import { useTranslations } from '@/components/translations-provider'

interface OrderData {
  id: string
  totalAmount: number
  currency: string
  confirmationNumber?: string
  pricing: {
    subtotal: number
    shippingCost: number
    totalAmount: number
  }
  items: Array<{
    id: string
    name: string
    description: string
    quantity: number
    totalPrice: number
    image?: string
  }>
  store?: {
    name: string
    domain: string
    logoUrl?: string
    requiresShipping?: boolean
    platform?: string
  }
}

interface ThankYouClientProps {
  checkoutId: string
}

export default function ThankYouClient({ checkoutId }: ThankYouClientProps) {
  const searchParams = useSearchParams()
  const { t } = useTranslations()
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrderData = async () => {
      // Essayer d'abord de récupérer les données de commande depuis sessionStorage
      const orderDataStr = sessionStorage.getItem('lastOrderData')

      if (orderDataStr) {
        try {
          const orderData = JSON.parse(orderDataStr)
          setOrderData(orderData)
          // Nettoyer sessionStorage après récupération réussie
          setLoading(false)

          // Si c'est un checkout externe (WooCommerce, etc.), rediriger automatiquement
          // Shopify gère sa propre page de confirmation, donc on ne redirige pas
          if (orderData.store?.domain && orderData.store?.platform !== 'SHOPIFY') {
            const returnUrl = `https://${orderData.store.domain}?heypay_success=1`
            setTimeout(() => {
              window.location.href = returnUrl
            }, 2000) // Attendre 2 secondes pour que l'utilisateur voie la confirmation
          }

          return
        } catch (err) {
          console.error('Erreur lors du parsing des données de commande:', err)
          sessionStorage.removeItem('lastOrderData')
        }
      }

      // Fallback : essayer avec paymentIntentId dans l'URL (pour compatibilité)
      const paymentIntentId = searchParams.get('paymentIntentId')

      if (!paymentIntentId) {
        setError('Données de commande manquantes')
        setLoading(false)
        return
      }

      try {
        const result = await getOrderData(paymentIntentId)

        if (result.success) {
          setOrderData(result.order)
        } else {
          setError(result.error || 'Erreur lors du chargement des données')
        }
      } catch (err) {
        setError('Erreur lors du chargement des données de commande')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderData()
  }, [searchParams])

  // Protection contre les envois multiples de Purchase
  const hasSentPurchase = useRef(false)

  // Envoyer l'événement Purchase au Meta Pixel et CompletePayment au TikTok Pixel (une seule fois)
  useEffect(() => {
    if (orderData && orderData.items && !hasSentPurchase.current) {
      // Préparer les données du pixel
      const contentIds = orderData.items.map((item: { productId?: string; id: string }) => item.productId || item.id)
      const contents = orderData.items.map((item: { productId?: string; id: string; quantity: number; price?: number; totalPrice: number }) => ({
        id: item.productId || item.id,
        quantity: item.quantity,
        item_price: item.price || (item.totalPrice / item.quantity)
      }))
      const numItems = orderData.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)

      // Meta Pixel - Envoyer l'événement Purchase avec orderId pour protection supplémentaire
      pixel.purchase({
        value: orderData.pricing?.totalAmount || orderData.totalAmount,
        currency: orderData.currency || 'EUR',
        content_ids: contentIds,
        content_type: 'product',
        contents: contents,
        num_items: numItems,
        orderId: orderData.id || checkoutId // Utiliser l'ID de commande pour éviter les doublons
      })

      hasSentPurchase.current = true

      // TikTok Pixel - Envoyer l'événement CompletePayment
      const tiktokContents = orderData.items.map((item: { productId?: string; id: string; quantity: number; price?: number; totalPrice: number }) => ({
        content_id: item.productId || item.id,
        quantity: item.quantity,
        price: item.price || (item.totalPrice / item.quantity)
      }))

      ttqpixel.completePayment({
        value: orderData.pricing?.totalAmount || orderData.totalAmount,
        currency: orderData.currency || 'EUR',
        content_type: 'product',
        quantity: numItems,
        contents: tiktokContents
      })
    }
  }, [orderData])

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(price)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">{t('thankYou.loadingOrder')}</p>
        </div>
      </div>
    )
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('thankYou.errorOccurred')}</h1>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            {t('thankYou.returnHome')}
          </button>
        </div>
      </div>
    )
  }

  const storeName = orderData?.store?.name || "Ma boutique"
  const storeLogo = orderData?.store?.logoUrl
  const storeDomain = orderData?.store?.domain

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Same style as checkout */}
      <header className="border-b border-gray-200 bg-white">
        {/* Mobile Header */}
        <div className="lg:hidden px-4 sm:px-6 py-4 flex items-center justify-between">
          <a
            href={storeDomain ? `https://${storeDomain}` : '#'}
            className="flex items-center"
          >
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="h-10 max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-lg font-semibold text-gray-900">{storeName}</span>
            )}
          </a>
          <a
            href={storeDomain ? `https://${storeDomain}/cart` : '#'}
            className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
            aria-label="Panier"
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
                href={storeDomain ? `https://${storeDomain}` : '#'}
                className="flex items-center"
              >
                {storeLogo ? (
                  <img
                    src={storeLogo}
                    alt={storeName}
                    className="h-10 max-w-[120px] object-contain"
                  />
                ) : (
                  <span className="text-lg font-semibold text-gray-900">{storeName}</span>
                )}
              </a>
            </div>
          </div>

          {/* Right side - Cart Icon */}
          <div className="lg:w-1/2">
            <div className="w-full max-w-[450px] px-6 lg:px-10 lg:pl-12 py-4 flex justify-end">
              <a
                href={storeDomain ? `https://${storeDomain}/cart` : '#'}
                className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
                aria-label="Panier"
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
            <span className="text-sm text-gray-900">{t('thankYou.orderSummary')}</span>
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
          <strong className="text-base text-gray-900">{formatPrice(orderData.pricing.total, orderData.pricing.currency)}</strong>
        </button>

        {/* Expandable content */}
        <div
          id="mobile-order-summary"
          className={`overflow-hidden transition-all duration-200 ease-in-out ${isOrderSummaryOpen ? 'max-h-[80vh] overflow-y-auto' : 'max-h-0'}`}
        >
          <div className="px-5 pt-4 pb-5 border-b border-[#e0e0e0]">
            {/* Product List */}
            <div className="space-y-4 mb-4">
              {orderData.items.map((item: { id: string; name: string; description?: string; variantTitle?: string; quantity: number; price: number; image?: string }) => (
                <div key={item.id} className="flex items-center gap-4">
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
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    {item.variantTitle && item.variantTitle.toLowerCase() !== 'default title' && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.variantTitle}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-900 flex-shrink-0">{formatPrice(item.price * item.quantity, orderData.pricing.currency)}</span>
                </div>
              ))}
            </div>

            {/* Cost Summary */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Sous-total</span>
                <span className="text-gray-900">{formatPrice(orderData.pricing.subtotal, orderData.pricing.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Expédition</span>
                <span className="text-gray-900">{orderData.pricing.shipping === 0 ? t('thankYou.free') : formatPrice(orderData.pricing.shipping, orderData.pricing.currency)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <strong className="text-base text-gray-900">{t('thankYou.total')}</strong>
                <div className="flex items-center gap-2">
                  <abbr title={orderData.pricing.currency?.toUpperCase()} className="text-xs text-gray-500 no-underline">{orderData.pricing.currency?.toUpperCase()}</abbr>
                  <strong className="text-base text-gray-900">{formatPrice(orderData.pricing.total, orderData.pricing.currency)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout - Same as checkout */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
        {/* Left Column - Confirmation Content (white background, 50% width) */}
        <div className="lg:w-1/2 bg-white">
          <div className="max-w-[550px] ml-auto px-4 sm:px-6 lg:px-10 lg:pr-12 py-6 lg:py-10">

            {/* Success Message */}
            <section className="mb-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-[72px] h-[72px] bg-black rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>
                <div className="pt-1">
                  <p className="text-sm text-gray-600 mb-1">{t('thankYou.confirmationNumber')} {orderData.confirmationNumber}</p>
                  <h1 className="text-[28px] font-semibold text-gray-900 leading-tight">{t('thankYou.thanks')} {orderData.customerName?.split(' ')[0] || ''} !</h1>
                </div>
              </div>
            </section>

            {/* Order Confirmed Box */}
            <section className="mb-6">
              <div className="border border-gray-200 rounded-lg p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('thankYou.orderConfirmed')}</h2>
                <p className="text-sm text-gray-600">
                  {t('thankYou.confirmationEmail')}
                </p>
              </div>
            </section>

            {/* Order Details */}
            <section className="mb-6">
              <div className="border border-gray-200 rounded-lg p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('thankYou.orderDetails')}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Contact Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">{t('thankYou.contact')}</h3>
                    <p className="text-sm text-gray-600">{orderData.customerEmail}</p>
                  </div>

                  {/* Shipping Method */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">{t('thankYou.shippingMethod')}</h3>
                    <p className="text-sm text-gray-600">
                      {orderData.store?.requiresShipping === false
                        ? t('thankYou.immediateDownload')
                        : orderData.shippingMethod || t('thankYou.standardShipping')}
                    </p>
                  </div>

                  {/* Shipping Address */}
                  {orderData.store?.requiresShipping !== false && orderData.shippingAddress && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{t('thankYou.shippingAddress')}</h3>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>{orderData.shippingAddress.name}</p>
                        <p>{orderData.shippingAddress.address}</p>
                        {orderData.shippingAddress.line2 && <p>{orderData.shippingAddress.line2}</p>}
                        <p>{orderData.shippingAddress.postalCode} {orderData.shippingAddress.city}</p>
                        <p>{orderData.shippingAddress.country}</p>
                      </div>
                    </div>
                  )}

                  {/* Billing Address */}
                  {orderData.store?.requiresShipping !== false && orderData.billingAddress && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{t('thankYou.billingAddress')}</h3>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>{orderData.billingAddress.name}</p>
                        <p>{orderData.billingAddress.address}</p>
                        {orderData.billingAddress.line2 && <p>{orderData.billingAddress.line2}</p>}
                        <p>{orderData.billingAddress.postalCode} {orderData.billingAddress.city}</p>
                        <p>{orderData.billingAddress.country}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Help & Return Button */}
            <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-gray-600">
                {t('thankYou.needHelp')}{' '}
                <a
                  href={orderData.store?.supportEmail
                    ? `mailto:${orderData.store.supportEmail}`
                    : `https://${storeDomain}`
                  }
                  className="text-black underline hover:no-underline"
                >
                  {t('thankYou.contactUs')}
                </a>
              </p>
              <button
                onClick={() => window.location.href = `https://${storeDomain}`}
                className="w-full sm:w-auto px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                {t('thankYou.continueShopping')}
              </button>
            </section>

            {/* Footer */}
            <footer className="mt-10 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <a href="#" className="hover:text-gray-700">{t('checkout.refundPolicy')}</a>
                <a href="#" className="hover:text-gray-700">{t('checkout.privacyPolicy')}</a>
                <a href="#" className="hover:text-gray-700">{t('checkout.termsOfUse')}</a>
              </div>
            </footer>
          </div>
        </div>

        {/* Right Column - Order Summary (Desktop) - 50% width, gray background */}
        <aside className="hidden lg:block lg:w-1/2 bg-gray-50 border-l border-gray-200">
          <div className="sticky top-0 p-6 lg:p-10 lg:pl-12 max-w-[450px]">

            {/* Product List */}
            <div className="space-y-4 mb-6">
              {orderData.items.map((item: { id: string; name: string; description?: string; variantTitle?: string; quantity: number; price: number; image?: string }) => (
                <div key={item.id} className="flex items-center gap-4">
                  {/* Product Image with Quantity Badge */}
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
                      {item.quantity}
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
                    {formatPrice(item.price * item.quantity, orderData.pricing.currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Cost Summary */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('thankYou.subtotal')}</span>
                <span className="text-gray-900">{formatPrice(orderData.pricing.subtotal, orderData.pricing.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('thankYou.shipping')}</span>
                <span className="text-gray-900">{orderData.pricing.shipping === 0 ? t('thankYou.free') : formatPrice(orderData.pricing.shipping, orderData.pricing.currency)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-base font-semibold text-gray-900">{t('thankYou.total')}</span>
                <div className="text-right">
                  <span className="text-xs text-gray-500 mr-2">{orderData.pricing.currency?.toUpperCase()}</span>
                  <span className="text-xl font-semibold text-gray-900">{formatPrice(orderData.pricing.total, orderData.pricing.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
