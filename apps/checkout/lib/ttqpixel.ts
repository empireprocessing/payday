/**
 * TikTok Pixel helpers - TypeScript
 * Documentation: https://ads.tiktok.com/help/article/standard-events-parameters
 */

declare global {
  interface Window {
    ttq?: {
      load: (pixelId: string) => void;
      page: () => void;
      track: (eventName: string, params?: Record<string, unknown>) => void;
      identify: (params: { email?: string; phone_number?: string }) => void;
    };
    TiktokAnalyticsObject?: string;
  }
}

/**
 * Initialize TikTok Pixel with the given ID
 */
export const init = (pixelId: string) => {
  if (!window.ttq) return;
  window.ttq.load(pixelId);
};

/**
 * Track a PageView event
 */
export const pageview = () => {
  if (!window.ttq) return;
  window.ttq.page();
  console.log('📊 TikTok Pixel: PageView');
};

/**
 * Track InitiateCheckout event
 */
export const initiateCheckout = (params: {
  value?: number;
  currency?: string;
  content_id?: string;
  content_type?: string;
  content_name?: string;
  quantity?: number;
  contents?: Array<{
    content_id: string;
    quantity: number;
    price?: number;
  }>;
}) => {
  if (!window.ttq) return;

  console.log('📊 TikTok Pixel: InitiateCheckout', params);
  window.ttq.track('InitiateCheckout', params);
};

/**
 * Track CompletePayment event (TikTok's equivalent of Purchase)
 */
export const completePayment = (params: {
  value: number;
  currency: string;
  content_id?: string;
  content_type?: string;
  content_name?: string;
  quantity?: number;
  contents?: Array<{
    content_id: string;
    quantity: number;
    price?: number;
  }>;
}) => {
  if (!window.ttq) return;

  console.log('📊 TikTok Pixel: CompletePayment', params);
  window.ttq.track('CompletePayment', params);
};

/**
 * Track a custom event
 */
export const event = (name: string, options: Record<string, unknown> = {}) => {
  if (!window.ttq) return;

  console.log(`📊 TikTok Pixel: ${name}`, options);
  window.ttq.track(name, options);
};

/**
 * Identify user for advanced matching
 */
export const identify = (params: { email?: string; phone_number?: string }) => {
  if (!window.ttq) return;

  console.log('📊 TikTok Pixel: Identify', params);
  window.ttq.identify(params);
};
