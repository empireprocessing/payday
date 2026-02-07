<?php
/**
 * Plugin Name: Remote Checkout Bridge
 * Description: Redirects WooCommerce checkout to a remote checkout site
 * Version: 1.1.0
 * Author: HeyPay
 * Requires PHP: 7.4
 * Requires at least: 6.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Remote_Checkout_Bridge {

    private $options;

    public function __construct() {
        $this->options = get_option('rcb_settings', []);

        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('template_redirect', [$this, 'intercept_checkout'], 1);
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'add_settings_link']);
    }

    public function add_settings_link($links) {
        $settings_link = '<a href="admin.php?page=remote-checkout-bridge">Réglages</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    public function add_admin_menu() {
        add_options_page(
            'Remote Checkout Bridge',
            'Remote Checkout Bridge',
            'manage_options',
            'remote-checkout-bridge',
            [$this, 'settings_page']
        );
    }

    public function register_settings() {
        register_setting('rcb_settings_group', 'rcb_settings', [$this, 'sanitize_settings']);

        add_settings_section(
            'rcb_main_section',
            'Configuration du Site B (Checkout)',
            null,
            'remote-checkout-bridge'
        );

        add_settings_field(
            'endpoint_url',
            'URL du Site B',
            [$this, 'render_endpoint_field'],
            'remote-checkout-bridge',
            'rcb_main_section'
        );

        add_settings_field(
            'enabled',
            'Activer la redirection',
            [$this, 'render_enabled_field'],
            'remote-checkout-bridge',
            'rcb_main_section'
        );
    }

    public function sanitize_settings($input) {
        $sanitized = [];
        $sanitized['endpoint_url'] = esc_url_raw(trailingslashit($input['endpoint_url'] ?? '') . 'wp-json/remote-checkout/v1/session/init');
        $sanitized['endpoint_url'] = str_replace('/wp-json/remote-checkout/v1/session/init/wp-json', '/wp-json', $sanitized['endpoint_url']);
        $sanitized['enabled'] = isset($input['enabled']) ? 1 : 0;
        return $sanitized;
    }

    public function render_endpoint_field() {
        $value = $this->options['endpoint_url'] ?? '';
        $display_value = str_replace('/wp-json/remote-checkout/v1/session/init', '', $value);
        ?>
        <input type="url" name="rcb_settings[endpoint_url]" value="<?php echo esc_attr($display_value); ?>" class="regular-text" placeholder="https://site-checkout.com" />
        <p class="description">L'URL de base du Site B (ex: https://checkout.example.com)</p>
        <?php
    }

    public function render_enabled_field() {
        $enabled = $this->options['enabled'] ?? 0;
        ?>
        <label>
            <input type="checkbox" name="rcb_settings[enabled]" value="1" <?php checked($enabled, 1); ?> />
            Rediriger le checkout vers le Site B
        </label>
        <?php
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Remote Checkout Bridge</h1>

            <form method="post" action="options.php">
                <?php
                settings_fields('rcb_settings_group');
                do_settings_sections('remote-checkout-bridge');
                submit_button('Enregistrer');
                ?>
            </form>

            <hr />
            <h2>Test de connexion</h2>
            <?php $this->render_connection_test(); ?>
        </div>
        <?php
    }

    private function render_connection_test() {
        $endpoint = $this->options['endpoint_url'] ?? '';

        if (empty($endpoint)) {
            echo '<p style="color: orange;">Configurez l\'URL du Site B pour tester la connexion.</p>';
            return;
        }

        $response = wp_remote_post($endpoint, [
            'body' => wp_json_encode([
                'domain' => 'test',
                'cartToken' => 'test',
                'lineItems' => [['quantity' => 1, 'unitPrice' => 1]],
                'returnUrl' => home_url(),
                'customer' => ['currency' => 'EUR', 'locale' => 'fr-FR']
            ]),
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 10
        ]);

        if (is_wp_error($response)) {
            echo '<p style="color: red;">Erreur de connexion : ' . esc_html($response->get_error_message()) . '</p>';
            return;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status === 200 && !empty($body['checkoutUrl'])) {
            echo '<p style="color: green;">Connexion OK - Le Site B répond correctement.</p>';
        } else {
            echo '<p style="color: red;">Le Site B a répondu avec le code ' . $status . '</p>';
            echo '<pre>' . esc_html(print_r($body, true)) . '</pre>';
        }
    }

    public function intercept_checkout() {
        $enabled = $this->options['enabled'] ?? 0;
        $endpoint = $this->options['endpoint_url'] ?? '';

        if (!$enabled || empty($endpoint)) {
            return;
        }

        if (!function_exists('WC') || !WC()->cart) {
            return;
        }

        if (!is_checkout() || is_checkout_pay_page()) {
            return;
        }

        if (is_wc_endpoint_url('order-pay')) {
            return;
        }

        if (WC()->cart->is_empty()) {
            return;
        }

        $cart = WC()->cart->get_cart();
        $line_items = [];

        foreach ($cart as $cart_item) {
            $product = $cart_item['data'];
            $quantity = $cart_item['quantity'];
            $unit_price = (float) $product->get_price();

            $line_items[] = [
                'quantity' => (int) $quantity,
                'unitPrice' => round($unit_price, 2)
            ];
        }

        if (empty($line_items)) {
            return;
        }

        $cart_token = '';
        $session_cookie = 'wp_woocommerce_session_' . COOKIEHASH;
        if (isset($_COOKIE[$session_cookie])) {
            $cart_token = md5($_COOKIE[$session_cookie]);
        } else {
            $cart_token = md5(uniqid('wc_cart_', true));
        }

        $site_domain = parse_url(get_site_url(), PHP_URL_HOST);

        $locale = determine_locale();
        if (empty($locale)) {
            $locale = get_user_locale();
        }
        $locale = str_replace('_', '-', $locale);

        $request_body = [
            'domain' => $site_domain,
            'cartToken' => $cart_token,
            'lineItems' => $line_items,
            'returnUrl' => home_url(),
            'customer' => [
                'currency' => get_woocommerce_currency(),
                'locale' => $locale
            ]
        ];

        $response = wp_remote_post($endpoint, [
            'body' => wp_json_encode($request_body),
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'timeout' => 30,
            'sslverify' => true
        ]);

        if (is_wp_error($response)) {
            wc_add_notice('Erreur de connexion au serveur de paiement: ' . $response->get_error_message(), 'error');
            return;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            wc_add_notice('Erreur du serveur de paiement (code ' . $status_code . ').', 'error');
            return;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (empty($data['checkoutUrl'])) {
            wc_add_notice('Réponse invalide du serveur de paiement.', 'error');
            return;
        }

        $checkout_url = esc_url_raw($data['checkoutUrl']);

        if (!filter_var($checkout_url, FILTER_VALIDATE_URL)) {
            wc_add_notice('URL de checkout invalide.', 'error');
            return;
        }

        wp_redirect($checkout_url, 302);
        exit;
    }
}

new Remote_Checkout_Bridge();
