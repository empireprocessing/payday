<?php
/**
 * Plugin Name: HeyPay Payment Gateway
 * Plugin URI:  https://heypay.one
 * Description: Accept payments with HeyPay - Smart payment routing with automatic PSP cascading. Supports cards, Apple Pay, Google Pay.
 * Version: 2.3.8
 * Author: HeyPay
 * Author URI:  https://heypay.one
 * License: GPL2
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: heypay-payment-gateway
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.0
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Declare HPOS compatibility BEFORE everything else
add_action('before_woocommerce_init', function() {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

// Define plugin constants
define('HEYPAY_VERSION', '2.3.8');
define('HEYPAY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('HEYPAY_PLUGIN_URL', plugin_dir_url(__FILE__));

// Helper function to log
if (!function_exists('heypay_log')) {
    function heypay_log($message, $level = 'INFO') {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[HeyPay $level] $message");
        }
    }
}

// Ensure WooCommerce is active
add_action('plugins_loaded', 'heypay_init', 11);

function heypay_init() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'heypay_woocommerce_missing_notice');
        return;
    }

    // Initialize the gateway
    add_filter('woocommerce_payment_gateways', 'heypay_add_gateway');
}

function heypay_woocommerce_missing_notice() {
    echo '<div class="notice notice-error"><p><strong>HeyPay Payment Gateway</strong> requires WooCommerce to be installed and activated.</p></div>';
}

function heypay_add_gateway($gateways) {
    $gateways[] = 'WC_Gateway_HeyPay';
    return $gateways;
}

// Load the gateway class
add_action('plugins_loaded', 'heypay_load_gateway_class', 12);

function heypay_load_gateway_class() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    class WC_Gateway_HeyPay extends WC_Payment_Gateway {

        public $api_url;

        public function __construct() {
            $this->id                 = 'heypay';
            $this->icon               = '';
            $this->has_fields         = true; // Payment fields on checkout page
            $this->method_title       = __('HeyPay', 'heypay-payment-gateway');
            $this->method_description = __('Accept payments with HeyPay - Smart payment routing with automatic PSP cascading. Supports cards, Apple Pay, Google Pay.', 'heypay-payment-gateway');

            // Load the settings
            $this->init_form_fields();
            $this->init_settings();

            // Define user set variables
            $this->title              = $this->get_option('title');
            $this->description        = $this->get_option('description');
            $this->api_url            = 'https://api.heypay.one'; // Hardcoded API URL
            $this->enabled            = $this->get_option('enabled');

            // Actions
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        }

        /**
         * Initialize Gateway Settings Form Fields
         */
        public function init_form_fields() {
            // Detect current site domain
            $site_domain = parse_url(get_site_url(), PHP_URL_HOST);

            $this->form_fields = array(
                'enabled' => array(
                    'title'   => __('Enable/Disable', 'heypay-payment-gateway'),
                    'type'    => 'checkbox',
                    'label'   => __('Enable HeyPay Payment Gateway', 'heypay-payment-gateway'),
                    'default' => 'no'
                ),
                'title' => array(
                    'title'       => __('Title', 'heypay-payment-gateway'),
                    'type'        => 'text',
                    'description' => __('Payment method title that customers will see during checkout.', 'heypay-payment-gateway'),
                    'default'     => __('Credit Card / Debit Card', 'heypay-payment-gateway'),
                    'desc_tip'    => true,
                ),
                'description' => array(
                    'title'       => __('Description', 'heypay-payment-gateway'),
                    'type'        => 'textarea',
                    'description' => __('Payment method description that customers will see during checkout.', 'heypay-payment-gateway'),
                    'default'     => __('Pay securely with your credit or debit card.', 'heypay-payment-gateway'),
                    'desc_tip'    => true,
                ),
                'detected_domain' => array(
                    'title'       => __('Auto-detected Domain', 'heypay-payment-gateway'),
                    'type'        => 'title',
                    'description' => sprintf(
                        __('Your store domain is: <strong>%s</strong><br>Make sure this domain is configured in your <a href="https://app.heypay.one" target="_blank">HeyPay Dashboard</a>.', 'heypay-payment-gateway'),
                        esc_html($site_domain)
                    ),
                ),
            );
        }

        /**
         * Payment fields (Stripe Elements will be mounted here)
         */
        public function payment_fields() {
            // Description
            if ($this->description) {
                echo '<div class="heypay-test-description">';
                echo wpautop(wptexturize($this->description));
                echo '</div>';
            }

            // Stripe card elements wrapper (like FunnelKit)
            echo '<div id="heypay-payment-wrapper">';

            // Card Number field
            echo '<div class="heypay-form-row">';
            echo '<label for="heypay-card-number">' . esc_html__('Card number', 'heypay-payment-gateway') . ' <span class="required">*</span></label>';
            echo '<div id="heypay-card-number" class="heypay-stripe-field heypay-card-number"></div>';
            echo '<span id="heypay-card-number-errors" class="heypay-error-text"></span>';
            echo '</div>';

            // Expiry and CVC fields (side by side)
            echo '<div class="heypay-form-row heypay-field-wrapper">';

            // Expiry field
            echo '<div class="heypay-field-half">';
            echo '<label for="heypay-card-expiry">' . esc_html__('Expiry date', 'heypay-payment-gateway') . ' <span class="required">*</span></label>';
            echo '<div id="heypay-card-expiry" class="heypay-stripe-field"></div>';
            echo '<span id="heypay-card-expiry-errors" class="heypay-error-text"></span>';
            echo '</div>';

            // CVC field
            echo '<div class="heypay-field-half">';
            echo '<label for="heypay-card-cvc">' . esc_html__('CVC', 'heypay-payment-gateway') . ' <span class="required">*</span></label>';
            echo '<div id="heypay-card-cvc" class="heypay-stripe-field"></div>';
            echo '<span id="heypay-card-cvc-errors" class="heypay-error-text"></span>';
            echo '</div>';

            echo '</div>';

            // General errors
            echo '<div id="heypay-card-errors" role="alert" class="heypay-error-text"></div>';
            echo '</div>';
        }

        /**
         * Process the payment
         * Native WooCommerce flow - receives order_id directly
         */
        public function process_payment($order_id) {
            heypay_log('🔍 process_payment called for order: ' . $order_id, 'INFO');

            $order = wc_get_order($order_id);

            if (!$order) {
                heypay_log('❌ Order not found: ' . $order_id, 'ERROR');
                wc_add_notice(__('Payment error: Order not found.', 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            // Get payment method ID and session ID from form
            $payment_method_id = isset($_POST['heypay_payment_method']) ? sanitize_text_field($_POST['heypay_payment_method']) : '';
            $session_id = isset($_POST['heypay_session_id']) ? sanitize_text_field($_POST['heypay_session_id']) : '';

            if (empty($payment_method_id)) {
                heypay_log('❌ No payment method ID provided', 'ERROR');
                wc_add_notice(__('Payment error: No payment method provided.', 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            if (empty($session_id)) {
                heypay_log('❌ No session ID provided', 'ERROR');
                wc_add_notice(__('Payment error: No session ID provided.', 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            heypay_log('✅ Payment method ID: ' . $payment_method_id, 'INFO');
            heypay_log('✅ Session ID: ' . $session_id, 'INFO');

            // Auto-detect site domain
            $site_domain = parse_url(get_site_url(), PHP_URL_HOST);
            heypay_log('🔍 Site domain: ' . $site_domain, 'INFO');

            // Prepare API request
            $api_url = trailingslashit($this->api_url) . 'payment/woocommerce/intent';
            heypay_log('🔍 API URL: ' . $api_url, 'INFO');

            $body = array(
                'domain'        => $site_domain,
                'amount'        => floatval($order->get_total()),
                'currency'      => $order->get_currency(),
                'orderId'       => strval($order_id),
                'customerEmail' => $order->get_billing_email(),
                'paymentMethod' => $payment_method_id,
                'id'            => $session_id, // PSP ID from prepare endpoint
            );

            heypay_log('🔍 Payment request - Amount: ' . $body['amount'] . ' ' . $body['currency'], 'INFO');

            // Call HeyPay API
            $response = wp_remote_post($api_url, array(
                'method'      => 'POST',
                'timeout'     => 30,
                'headers'     => array(
                    'Content-Type' => 'application/json',
                ),
                'body'        => json_encode($body),
            ));

            if (is_wp_error($response)) {
                heypay_log('❌ API request failed: ' . $response->get_error_message(), 'ERROR');
                wc_add_notice(__('Payment error: ' . $response->get_error_message(), 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = wp_remote_retrieve_body($response);
            $data = json_decode($response_body, true);

            heypay_log('🔍 API response code: ' . $response_code, 'INFO');
            heypay_log('🔍 API response: ' . $response_body, 'INFO');

            if ($response_code !== 200 && $response_code !== 201) {
                heypay_log('❌ API error: ' . ($data['error'] ?? 'Unknown error'), 'ERROR');
                wc_add_notice(__('Payment error: ' . ($data['error'] ?? 'Payment processing failed'), 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            if (!$data || !isset($data['success']) || !$data['success']) {
                heypay_log('❌ Payment creation failed: ' . ($data['error'] ?? 'Unknown error'), 'ERROR');
                wc_add_notice(__('Payment error: ' . ($data['error'] ?? 'Payment processing failed'), 'heypay-payment-gateway'), 'error');
                return array('result' => 'failure');
            }

            // Store payment info in order meta
            $order->update_meta_data('_heypay_payment_intent_id', $data['paymentIntentId']);
            $order->update_meta_data('_heypay_payment_method_id', $payment_method_id);

            $order->save();

            heypay_log('✅ Payment intent created successfully: ' . $data['paymentIntentId'], 'INFO');
            heypay_log('🔍 Raw API response: ' . json_encode($data), 'DEBUG');
            heypay_log('🔍 Payment Intent status: ' . ($data['status'] ?? 'NOT SET'), 'INFO');

            // Get payment status from API response
            $status = isset($data['status']) ? $data['status'] : 'unknown';

            // Like FunnelKit: Check if 3DS/SCA is required based on PaymentIntent status
            if ($status === 'requires_action' || $status === 'requires_confirmation') {
                // 3DS/SCA required - redirect to checkout with hash (like FunnelKit)
                if (isset($data['clientSecret']) && isset($data['paymentIntentId']) && isset($data['publishableKey'])) {
                    $order->update_meta_data('_heypay_client_secret', $data['clientSecret']);
                    $order->update_meta_data('_heypay_payment_intent_id', $data['paymentIntentId']);
                    $order->update_meta_data('_heypay_publishable_key', $data['publishableKey']); // Save the publishable key used
                    $order->save();
                    heypay_log('🔐 3DS/SCA required - redirecting with hash for client-side confirmation', 'INFO');

                    $order->update_status('pending', __('Awaiting 3DS authentication from customer.', 'heypay-payment-gateway'));

                    // Construct hash for 3DS authentication (like FunnelKit)
                    // Format: #heypay-confirm-pi-{clientSecret}:{returnUrl}:{orderId}:{publishableKey}
                    // Return ONLY the hash, not a full URL - WooCommerce will add it to current page
                    $return_url = rawurlencode($this->get_return_url($order));
                    $redirect = sprintf('#heypay-confirm-pi-%s:%s:%s:%s',
                        $data['clientSecret'],
                        $return_url,
                        $order->get_id(),
                        $data['publishableKey']
                    );

                    heypay_log('🔗 Redirect hash for 3DS: ' . $redirect, 'DEBUG');

                    return array(
                        'result'   => 'success',
                        'redirect' => $redirect  // Just the hash, not a full URL
                    );
                }
            }

            // Payment succeeded immediately (no 3DS required)
            if ($status === 'succeeded') {
                $order->payment_complete($data['paymentIntentId']);
                $order->add_order_note(__('Payment completed via HeyPay (no 3DS required).', 'heypay-payment-gateway'));
                heypay_log('✅ Payment completed immediately (no 3DS)', 'INFO');

                // Return success and redirect to thank you page
                return array(
                    'result'   => 'success',
                    'redirect' => $this->get_return_url($order)
                );
            }

            // Fallback for other statuses: mark as on-hold and redirect to thank you page
            heypay_log('⚠️ Unexpected payment status: ' . $status . ' - marking as on-hold', 'WARNING');
            $order->update_status('on-hold', __('Awaiting payment confirmation from HeyPay.', 'heypay-payment-gateway'));

            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url($order)
            );
        }
    }
}

// Note: heypay_ajax_process_payment() removed - no longer needed with native WooCommerce flow
// Payment processing now happens in process_payment() method above

/**
 * Get Stripe credentials from HeyPay API (server-side)
 * Like beatmanltd's get_dynamic_stripe_credentials()
 */
function heypay_get_stripe_credentials() {
    $gateway = new WC_Gateway_HeyPay();
    $site_domain = parse_url(get_site_url(), PHP_URL_HOST);

    $response = wp_remote_post($gateway->api_url . '/payment/woocommerce/prepare', array(
        'method'      => 'POST',
        'timeout'     => 30,
        'headers'     => array(
            'Content-Type' => 'application/json',
        ),
        'body'        => json_encode(array(
            'domain' => $site_domain
        )),
    ));

    if (is_wp_error($response)) {
        heypay_log('❌ Failed to get Stripe credentials: ' . $response->get_error_message(), 'ERROR');
        return false;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);

    if (!$body || !isset($body['success']) || !$body['success']) {
        heypay_log('❌ API error: ' . ($body['error'] ?? 'Unknown error'), 'ERROR');
        return false;
    }

    return array(
        'publishableKey' => sanitize_text_field($body['publishableKey']),
        'sessionId'      => sanitize_text_field($body['id']),
    );
}

/**
 * Enqueue Stripe.js and custom scripts
 */
add_action('wp_enqueue_scripts', 'heypay_enqueue_scripts');

function heypay_enqueue_scripts() {
    // Enqueue on checkout page and order-pay page (like FunnelKit)
    if ((is_checkout() && !is_order_received_page()) || is_checkout_pay_page()) {
        // Enqueue Stripe.js
        wp_enqueue_script('stripe-js', 'https://js.stripe.com/v3/', array(), null, true);

        // Enqueue CSS
        wp_enqueue_style(
            'heypay-checkout',
            HEYPAY_PLUGIN_URL . 'assets/css/checkout.css',
            array(),
            HEYPAY_VERSION
        );

        // Enqueue our custom script
        wp_enqueue_script(
            'heypay-checkout-js',
            HEYPAY_PLUGIN_URL . 'assets/js/checkout.js',
            array('jquery', 'stripe-js'),
            HEYPAY_VERSION,
            true
        );

        // Get Stripe credentials from HeyPay API (server-side call)
        $creds = heypay_get_stripe_credentials();

        // Localize script with credentials
        wp_localize_script('heypay-checkout-js', 'heypayData', array(
            'ajaxUrl'        => admin_url('admin-ajax.php'),
            'nonce'          => wp_create_nonce('heypay_payment'),
            'publishableKey' => isset($creds['publishableKey']) ? $creds['publishableKey'] : '',
            'sessionId'      => isset($creds['sessionId']) ? $creds['sessionId'] : '',
            'error'          => $creds ? false : '⚠️ Failed to fetch Stripe credentials'
        ));
    }
}

/**
 * AJAX handler to confirm payment after 3DS authentication
 */
add_action('wp_ajax_heypay_confirm_payment', 'heypay_ajax_confirm_payment');
add_action('wp_ajax_nopriv_heypay_confirm_payment', 'heypay_ajax_confirm_payment');

function heypay_ajax_confirm_payment() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'heypay_payment')) {
        heypay_log('❌ Invalid nonce for confirm payment', 'ERROR');
        wp_send_json_error('Invalid security token');
        return;
    }

    $order_id = isset($_POST['order_id']) ? absint($_POST['order_id']) : 0;
    $payment_intent_id = isset($_POST['payment_intent_id']) ? sanitize_text_field($_POST['payment_intent_id']) : '';

    if (!$order_id || !$payment_intent_id) {
        heypay_log('❌ Missing order_id or payment_intent_id', 'ERROR');
        wp_send_json_error('Missing required parameters');
        return;
    }

    $order = wc_get_order($order_id);

    if (!$order) {
        heypay_log('❌ Order not found: ' . $order_id, 'ERROR');
        wp_send_json_error('Order not found');
        return;
    }

    // Verify this is a HeyPay order
    if ($order->get_payment_method() !== 'heypay') {
        heypay_log('❌ Not a HeyPay order: ' . $order_id, 'ERROR');
        wp_send_json_error('Invalid payment method');
        return;
    }

    // Verify payment intent matches
    $stored_intent_id = $order->get_meta('_heypay_payment_intent_id');
    if ($stored_intent_id !== $payment_intent_id) {
        heypay_log('❌ Payment Intent ID mismatch for order: ' . $order_id, 'ERROR');
        wp_send_json_error('Payment intent mismatch');
        return;
    }

    heypay_log('✅ 3DS authentication confirmed for order: ' . $order_id . ' - PaymentIntent: ' . $payment_intent_id, 'INFO');

    // Mark order as paid
    $order->payment_complete($payment_intent_id);
    $order->add_order_note(__('Payment completed via HeyPay after 3DS authentication.', 'heypay-payment-gateway'));

    // Empty cart
    if (!is_null(WC()->cart)) {
        WC()->cart->empty_cart();
    }

    heypay_log('✅ Order ' . $order_id . ' marked as paid', 'INFO');

    wp_send_json_success(array(
        'message' => 'Payment confirmed',
        'order_id' => $order_id
    ));
}
