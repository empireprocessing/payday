/**
 * Facebook Pixel helpers - TypeScript
 * Documentation: https://developers.facebook.com/docs/meta-pixel
 */

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
    _fbq?: Window['fbq'];
  }
}

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

/**
 * Initialiser le pixel (appelé automatiquement par le script)
 */
export const init = (pixelId: string) => {
  if (!window.fbq) return;
  window.fbq('init', pixelId, {});
};

/**
 * Tracker une page view
 */
export const pageview = () => {
  if (!window.fbq) return;
  window.fbq('track', 'PageView', {});
};

/**
 * Événement InitiateCheckout
 */
export const initiateCheckout = (params: {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  num_items?: number;
}) => {
  if (!window.fbq) return;

  console.log('📊 FB Pixel: InitiateCheckout', params);
  window.fbq('track', 'InitiateCheckout', params);
};

/**
 * Événement AddPaymentInfo
 * Déclenché quand l'utilisateur commence à entrer ses informations de paiement
 */
export const addPaymentInfo = (params: {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  num_items?: number;
}) => {
  if (!window.fbq) return;

  console.log('📊 FB Pixel: AddPaymentInfo', params);
  window.fbq('track', 'AddPaymentInfo', params);
};

/**
 * Événement Purchase
 */
export const purchase = (params: {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  num_items?: number;
  orderId?: string; // Identifiant unique pour éviter les doublons
}) => {
  if (!window.fbq) return;

  // Protection contre les doublons : vérifier si l'événement a déjà été envoyé pour cette commande
  if (params.orderId) {
    const sentKey = `fb_pixel_purchase_${params.orderId}`;
    if (sessionStorage.getItem(sentKey)) {
      console.log('📊 FB Pixel: Purchase déjà envoyé pour cette commande, ignoré');
      return;
    }
    sessionStorage.setItem(sentKey, 'true');
  }

  console.log('📊 FB Pixel: Purchase', params);
  window.fbq('track', 'Purchase', params);
};

/**
 * Événement personnalisé
 */
export const event = (name: string, options: Record<string, unknown> = {}) => {
  if (!window.fbq) return;

  console.log(`📊 FB Pixel: ${name}`, options);
  window.fbq('track', name, options);
};
