'use server'

// Configuration de l'API interne
const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:5000'

class TrackingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrackingError'
  }
}

async function trackEvent(endpoint: string, data: unknown): Promise<void> {
  console.log('Tracking event:', endpoint, data)
  try {
    const response = await fetch(`${API_BASE_URL}/checkout-events/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new TrackingError(`Failed to track event: ${response.status}`)
    }
  } catch (error) {
    // On ne fait pas échouer l'application si le tracking échoue
    console.error('Tracking error:', error)
  }
}

// checkout-initiated est tracké côté API lors de la création du checkout

/**
 * Track le progrès de remplissage des infos personnelles
 */
export async function trackCustomerInfoProgress(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('customer-info-progress', { checkoutId, metadata })
}

/**
 * Track quand l'utilisateur a rempli ses infos personnelles
 */
export async function trackCustomerInfoEntered(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('customer-info-entered', { checkoutId, metadata })
}

/**
 * Track quand l'utilisateur a commencé à taper dans les champs de paiement
 */
export async function trackPaymentInfoStarted(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('payment-info-started', { checkoutId, metadata })
}

/**
 * Track quand l'utilisateur a complété tous les champs de paiement obligatoires
 */
export async function trackPaymentInfoCompleted(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('payment-info-completed', { checkoutId, metadata })
}

/**
 * Track quand l'utilisateur a cliqué sur le bouton payer
 */
export async function trackPayButtonClicked(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('pay-button-clicked', { checkoutId, metadata })
}

/**
 * Track une tentative de paiement
 */
export async function trackPaymentAttempted(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('payment-attempted', { checkoutId, metadata })
}

/**
 * Track un paiement réussi
 */
export async function trackPaymentSuccessful(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('payment-successful', { checkoutId, metadata })
}

/**
 * Track un paiement échoué
 */
export async function trackPaymentFailed(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('payment-failed', { checkoutId, metadata })
}

/**
 * Track l'affichage des options de paiement express
 */
export async function trackExpressCheckoutDisplayed(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('express-checkout-displayed', { checkoutId, metadata })
}

/**
 * Track le clic sur une option de paiement express
 */
export async function trackExpressCheckoutClicked(
  checkoutId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent('express-checkout-clicked', { checkoutId, metadata })
}
