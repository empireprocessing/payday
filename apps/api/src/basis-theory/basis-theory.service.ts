import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ChargeCardParams {
  tokenIntentId: string;
  amount: number; // in cents
  currency: string;
  stripeSecretKey: string;           // Platform's secret key
  stripeConnectedAccountId: string;  // Connected account "acct_xxx"
  customerId?: string;               // Stripe Customer ID on connected account
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;           // Prevents double charges on retries
  shippingData?: {
    name: string;
    address: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

export interface ChargeCardResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;          // For 3DS handleNextAction
  status?: string;                // "succeeded" | "requires_action" | "requires_payment_method"
  networkTransactionId?: string;
  error?: string;
  stripeErrorCode?: string;       // For retry routing decisions
}

export interface SaveCardParams {
  tokenIntentId: string;
}

export interface SaveCardResult {
  success: boolean;
  tokenId?: string;
  card?: {
    brand: string;
    last4: string;
    expirationMonth: number;
    expirationYear: number;
  };
  error?: string;
}

export interface ChargeSavedCardParams {
  tokenId: string;
  amount: number;
  currency: string;
  stripeSecretKey: string;
  stripeConnectedAccountId: string;
  customerId?: string;
  networkTransactionId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

// ── Service ─────────────────────────────────────────────────────────

@Injectable()
export class BasisTheoryService {
  private readonly logger = new Logger(BasisTheoryService.name);

  /**
   * Create a Stripe Customer on a connected account using the platform key
   */
  async createCustomerOnConnectedAccount(params: {
    stripeSecretKey: string;
    stripeConnectedAccountId: string;
    email?: string;
    name?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  }): Promise<string> {
    const stripe = new Stripe(params.stripeSecretKey, { typescript: true });

    const customerData: Stripe.CustomerCreateParams = {};
    if (params.email) customerData.email = params.email;
    if (params.name) customerData.name = params.name;
    if (params.phone) customerData.phone = params.phone;
    if (params.address?.line1) {
      customerData.address = {
        line1: params.address.line1,
        line2: params.address.line2,
        city: params.address.city,
        state: params.address.state,
        postal_code: params.address.postal_code,
        country: params.address.country,
      };
    }

    const customer = await stripe.customers.create(customerData, {
      stripeAccount: params.stripeConnectedAccountId,
    });

    this.logger.log(`Customer created on connected account ${params.stripeConnectedAccountId}: ${customer.id}`);
    return customer.id;
  }

  /**
   * Charge a card using Basis Theory Proxy -> Stripe (Direct Charge on connected account)
   * Creates and confirms a PaymentIntent in one call via BT proxy
   */
  async chargeCard(params: ChargeCardParams): Promise<ChargeCardResult> {
    const {
      tokenIntentId, amount, currency,
      stripeSecretKey, stripeConnectedAccountId,
      customerId, description, metadata, idempotencyKey, shippingData,
    } = params;

    this.logger.log(`Charging card via BT proxy -> Connected account ${stripeConnectedAccountId}`);
    this.logger.log(`  Amount: ${amount} ${currency.toUpperCase()}, Token: ${tokenIntentId}`);

    try {
      const formData = new URLSearchParams();
      formData.append('amount', amount.toString());
      formData.append('currency', currency.toLowerCase());
      formData.append('confirm', 'true');
      formData.append('automatic_payment_methods[enabled]', 'true');
      formData.append('automatic_payment_methods[allow_redirects]', 'never');

      if (customerId) {
        formData.append('customer', customerId);
        formData.append('setup_future_usage', 'off_session');
      }

      if (description) {
        formData.append('description', description);
      }

      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, value);
        });
      }

      // Shipping data for Stripe Radar (improves risk score)
      if (shippingData?.address?.line1) {
        formData.append('shipping[name]', shippingData.name);
        formData.append('shipping[address][line1]', shippingData.address.line1);
        if (shippingData.address.line2) formData.append('shipping[address][line2]', shippingData.address.line2);
        if (shippingData.address.city) formData.append('shipping[address][city]', shippingData.address.city);
        if (shippingData.address.state) formData.append('shipping[address][state]', shippingData.address.state);
        if (shippingData.address.postal_code) formData.append('shipping[address][postal_code]', shippingData.address.postal_code);
        if (shippingData.address.country) formData.append('shipping[address][country]', shippingData.address.country);
      }

      // Inject card data via Basis Theory expression syntax
      formData.append('payment_method_data[type]', 'card');
      formData.append(
        'payment_method_data[card][number]',
        `{{ token_intent: ${tokenIntentId} | json: "$.data.number" }}`
      );
      formData.append(
        'payment_method_data[card][exp_month]',
        `{{ token_intent: ${tokenIntentId} | json: "$.data" | card_exp: "MM" }}`
      );
      formData.append(
        'payment_method_data[card][exp_year]',
        `{{ token_intent: ${tokenIntentId} | json: "$.data" | card_exp: "YYYY" }}`
      );
      formData.append(
        'payment_method_data[card][cvc]',
        `{{ token_intent: ${tokenIntentId} | json: "$.data.cvc" }}`
      );

      // Call Stripe via Basis Theory Proxy with Direct Charge on connected account
      const headers: Record<string, string> = {
        'BT-API-KEY': process.env.BASIS_THEORY_API_KEY!,
        'BT-PROXY-URL': 'https://api.stripe.com/v1/payment_intents',
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Stripe-Account': stripeConnectedAccountId,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const response = await fetch('https://api.basistheory.com/proxy', {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Stripe error via BT proxy: ${JSON.stringify(result)}`);
        return {
          success: false,
          error: result.error?.message || 'Payment failed',
          stripeErrorCode: result.error?.code || result.error?.decline_code,
        };
      }

      // Handle different payment statuses
      const status = result.status;
      const networkTransactionId =
        result.latest_charge?.payment_method_details?.card?.network_transaction_id;

      if (status === 'succeeded') {
        this.logger.log(`Payment succeeded: ${result.id} on account ${stripeConnectedAccountId}`);
        return {
          success: true,
          paymentIntentId: result.id,
          clientSecret: result.client_secret,
          status: 'succeeded',
          networkTransactionId,
        };
      }

      if (status === 'requires_action') {
        this.logger.log(`Payment requires 3DS: ${result.id} on account ${stripeConnectedAccountId}`);
        return {
          success: true,
          paymentIntentId: result.id,
          clientSecret: result.client_secret,
          status: 'requires_action',
          networkTransactionId,
        };
      }

      // Other statuses (requires_payment_method, canceled, etc.) = failure
      this.logger.warn(`Payment status ${status}: ${result.id}`);
      return {
        success: false,
        paymentIntentId: result.id,
        status,
        error: result.last_payment_error?.message || `Payment status: ${status}`,
        stripeErrorCode: result.last_payment_error?.code || result.last_payment_error?.decline_code,
      };
    } catch (error) {
      this.logger.error(`Error charging card via BT proxy: ${error.message}`);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  }

  /**
   * Convert a Token Intent into a persistent Token for future charges
   */
  async saveCard(params: SaveCardParams): Promise<SaveCardResult> {
    const { tokenIntentId } = params;
    this.logger.log(`Converting token intent to persistent token: ${tokenIntentId}`);

    try {
      const response = await fetch('https://api.basistheory.com/tokens', {
        method: 'POST',
        headers: {
          'BT-API-KEY': process.env.BASIS_THEORY_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token_intent_id: tokenIntentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Error saving card: ${JSON.stringify(result)}`);
        return {
          success: false,
          error: result.error?.message || 'Failed to save card',
        };
      }

      this.logger.log(`Card saved with token ID: ${result.id}`);
      return {
        success: true,
        tokenId: result.id,
        card: {
          brand: result.card?.brand,
          last4: result.card?.last4,
          expirationMonth: result.card?.expiration_month,
          expirationYear: result.card?.expiration_year,
        },
      };
    } catch (error) {
      this.logger.error(`Error saving card: ${error.message}`);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  }

  /**
   * Charge a saved card using persistent token via BT Proxy -> Stripe (Direct Charge)
   */
  async chargeSavedCard(params: ChargeSavedCardParams): Promise<ChargeCardResult> {
    const {
      tokenId, amount, currency,
      stripeSecretKey, stripeConnectedAccountId,
      customerId, networkTransactionId, description, metadata, idempotencyKey,
    } = params;

    this.logger.log(`Charging saved card via BT proxy -> Connected account ${stripeConnectedAccountId}`);

    try {
      const formData = new URLSearchParams();
      formData.append('amount', amount.toString());
      formData.append('currency', currency.toLowerCase());
      formData.append('confirm', 'true');
      formData.append('automatic_payment_methods[enabled]', 'true');
      formData.append('automatic_payment_methods[allow_redirects]', 'never');

      if (customerId) {
        formData.append('customer', customerId);
      }

      if (description) {
        formData.append('description', description);
      }

      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, value);
        });
      }

      // Use persistent token for card data
      formData.append('payment_method_data[type]', 'card');
      formData.append(
        'payment_method_data[card][number]',
        `{{ token: ${tokenId} | json: "$.data.number" }}`
      );
      formData.append(
        'payment_method_data[card][exp_month]',
        `{{ token: ${tokenId} | json: "$.data.expiration_date.month" }}`
      );
      formData.append(
        'payment_method_data[card][exp_year]',
        `{{ token: ${tokenId} | json: "$.data.expiration_date.year" }}`
      );
      formData.append(
        'payment_method_data[card][cvc]',
        `{{ token: ${tokenId} | json: "$.data.cvc" }}`
      );

      // MIT exemption for better approval rates on recurring charges
      if (networkTransactionId) {
        formData.append(
          'payment_method_options[card][mit_exemption][network_transaction_id]',
          networkTransactionId
        );
      }

      const savedHeaders: Record<string, string> = {
        'BT-API-KEY': process.env.BASIS_THEORY_API_KEY!,
        'BT-PROXY-URL': 'https://api.stripe.com/v1/payment_intents',
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Stripe-Account': stripeConnectedAccountId,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (idempotencyKey) {
        savedHeaders['Idempotency-Key'] = idempotencyKey;
      }

      const response = await fetch('https://api.basistheory.com/proxy', {
        method: 'POST',
        headers: savedHeaders,
        body: formData.toString(),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Stripe error: ${JSON.stringify(result)}`);
        return {
          success: false,
          error: result.error?.message || 'Payment failed',
          stripeErrorCode: result.error?.code || result.error?.decline_code,
        };
      }

      this.logger.log(`Payment successful: ${result.id}`);
      return {
        success: true,
        paymentIntentId: result.id,
        clientSecret: result.client_secret,
        status: result.status,
        networkTransactionId: result.latest_charge?.payment_method_details?.card?.network_transaction_id,
      };
    } catch (error) {
      this.logger.error(`Error charging saved card: ${error.message}`);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  }
}
