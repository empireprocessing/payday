<?php
/**
 * Plugin Name: Remote Checkout API
 * Description: Receives cart data from remote sites and rebuilds checkout sessions
 * Version: 1.1.0
 * Author: HeyPay
 * Requires PHP: 7.4
 * Requires at least: 6.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Remote_Checkout_API {

    private $options;

    public function __construct() {
        $this->options = get_option('rca_settings', []);

        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('init', [$this, 'add_rewrite_rules']);
        add_filter('query_vars', [$this, 'add_query_vars']);
        add_action('template_redirect', [$this, 'handle_remote_checkout'], 1);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'add_settings_link']);
    }

    public function add_settings_link($links) {
        $settings_link = '<a href="admin.php?page=remote-checkout-api">Réglages</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    public function add_admin_menu() {
        add_options_page(
            'Remote Checkout API',
            'Remote Checkout API',
            'manage_options',
            'remote-checkout-api',
            [$this, 'settings_page']
        );
    }

    public function register_settings() {
        register_setting('rca_settings_group', 'rca_settings', [$this, 'sanitize_settings']);

        add_settings_section(
            'rca_main_section',
            'Configuration',
            null,
            'remote-checkout-api'
        );

        add_settings_field(
            'enabled',
            'Activer l\'API',
            [$this, 'render_enabled_field'],
            'remote-checkout-api',
            'rca_main_section'
        );

        add_settings_field(
            'allowed_domains',
            'Domaines autorisés',
            [$this, 'render_domains_field'],
            'remote-checkout-api',
            'rca_main_section'
        );
    }

    public function sanitize_settings($input) {
        $sanitized = [];
        $sanitized['enabled'] = isset($input['enabled']) ? 1 : 0;
        $sanitized['allowed_domains'] = sanitize_textarea_field($input['allowed_domains'] ?? '');
        return $sanitized;
    }

    public function render_enabled_field() {
        $enabled = $this->options['enabled'] ?? 1;
        ?>
        <label>
            <input type="checkbox" name="rca_settings[enabled]" value="1" <?php checked($enabled, 1); ?> />
            Accepter les requêtes de checkout distant
        </label>
        <?php
    }

    public function render_domains_field() {
        $domains = $this->options['allowed_domains'] ?? '';
        ?>
        <textarea name="rca_settings[allowed_domains]" rows="4" class="large-text"><?php echo esc_textarea($domains); ?></textarea>
        <p class="description">Un domaine par ligne (ex: site-a.com). Laissez vide pour accepter tous les domaines.</p>
        <?php
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Remote Checkout API</h1>

            <form method="post" action="options.php">
                <?php
                settings_fields('rca_settings_group');
                do_settings_sections('remote-checkout-api');
                submit_button('Enregistrer');
                ?>
            </form>

            <hr />
            <h2>Informations</h2>
            <table class="form-table">
                <tr>
                    <th>URL de l'API</th>
                    <td><code><?php echo esc_html(home_url('/wp-json/remote-checkout/v1/session/init')); ?></code></td>
                </tr>
                <tr>
                    <th>URL de checkout</th>
                    <td><code><?php echo esc_html(home_url('/remote-checkout/?token=...')); ?></code></td>
                </tr>
            </table>

            <hr />
            <h2>Produits disponibles</h2>
            <?php $this->render_products_table(); ?>
        </div>
        <?php
    }

    private function render_products_table() {
        if (!function_exists('wc_get_products')) {
            echo '<p style="color: red;">WooCommerce n\'est pas actif.</p>';
            return;
        }

        $products = wc_get_products([
            'status' => 'publish',
            'limit' => 50,
            'orderby' => 'price',
            'order' => 'ASC'
        ]);

        if (empty($products)) {
            echo '<p>Aucun produit publié.</p>';
            return;
        }

        echo '<table class="widefat striped">';
        echo '<thead><tr><th>ID</th><th>Nom</th><th>Prix</th><th>Type</th></tr></thead>';
        echo '<tbody>';
        foreach ($products as $product) {
            echo '<tr>';
            echo '<td>' . esc_html($product->get_id()) . '</td>';
            echo '<td>' . esc_html($product->get_name()) . '</td>';
            echo '<td><strong>' . esc_html($product->get_price()) . '</strong> ' . get_woocommerce_currency_symbol() . '</td>';
            echo '<td>' . esc_html($product->get_type()) . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
        echo '<p class="description">Ces produits peuvent être ajoutés au panier via leur prix.</p>';
    }

    public function register_rest_routes() {
        register_rest_route('remote-checkout/v1', '/session/init', [
            'methods' => 'POST',
            'callback' => [$this, 'init_session'],
            'permission_callback' => '__return_true'
        ]);
    }

    public function init_session(WP_REST_Request $request) {
        $enabled = $this->options['enabled'] ?? 1;
        if (!$enabled) {
            return new WP_Error('api_disabled', 'API désactivée', ['status' => 403]);
        }

        $body = $request->get_json_params();

        // Check allowed domains
        $allowed_domains = $this->options['allowed_domains'] ?? '';
        if (!empty($allowed_domains)) {
            $domains = array_filter(array_map('trim', explode("\n", $allowed_domains)));
            $request_domain = sanitize_text_field($body['domain'] ?? '');
            if (!empty($domains) && !in_array($request_domain, $domains)) {
                return new WP_Error('domain_not_allowed', 'Domaine non autorisé', ['status' => 403]);
            }
        }

        if (empty($body['lineItems']) || !is_array($body['lineItems'])) {
            return new WP_Error('invalid_request', 'lineItems required', ['status' => 400]);
        }

        $token = 'rcb_' . bin2hex(random_bytes(16));

        $session_data = [
            'domain' => sanitize_text_field($body['domain'] ?? ''),
            'cartToken' => sanitize_text_field($body['cartToken'] ?? ''),
            'lineItems' => $body['lineItems'],
            'returnUrl' => esc_url_raw($body['returnUrl'] ?? ''),
            'customer' => $body['customer'] ?? []
        ];

        set_transient('rca_session_' . $token, $session_data, 30 * MINUTE_IN_SECONDS);

        $checkout_url = home_url('/remote-checkout/?token=' . $token);

        return rest_ensure_response([
            'checkoutUrl' => $checkout_url
        ]);
    }

    public function add_rewrite_rules() {
        add_rewrite_rule(
            '^remote-checkout/?$',
            'index.php?remote_checkout=1',
            'top'
        );
    }

    public function add_query_vars($vars) {
        $vars[] = 'remote_checkout';
        return $vars;
    }

    public function handle_remote_checkout() {
        $is_remote_checkout = get_query_var('remote_checkout');

        if (!$is_remote_checkout) {
            $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
            if (strpos($request_uri, '/remote-checkout/') === false && strpos($request_uri, '/remote-checkout?') === false) {
                return;
            }
        }

        $token = isset($_GET['token']) ? sanitize_text_field($_GET['token']) : '';

        if (empty($token)) {
            wp_die('Token manquant', 'Erreur', ['response' => 400]);
        }

        $session_data = get_transient('rca_session_' . $token);

        if (!$session_data) {
            wp_die('Session expirée ou invalide', 'Erreur', ['response' => 400]);
        }

        if (!function_exists('WC')) {
            wp_die('WooCommerce non disponible', 'Erreur', ['response' => 500]);
        }

        // Initialize WooCommerce session if needed
        if (!WC()->session) {
            WC()->session = new WC_Session_Handler();
            WC()->session->init();
        }

        if (!WC()->session->has_session()) {
            WC()->session->set_customer_session_cookie(true);
        }

        // Initialize cart if needed
        if (!WC()->cart) {
            WC()->cart = new WC_Cart();
        }

        // Initialize customer if needed
        if (!WC()->customer) {
            WC()->customer = new WC_Customer(get_current_user_id(), true);
        }

        WC()->cart->empty_cart();

        $line_items = $session_data['lineItems'];
        $added_count = 0;

        foreach ($line_items as $item) {
            $quantity = isset($item['quantity']) ? (int) $item['quantity'] : 1;
            $unit_price = isset($item['unitPrice']) ? (float) $item['unitPrice'] : 0;

            if ($unit_price <= 0) {
                continue;
            }

            $product_id = $this->find_product_by_price($unit_price);

            if ($product_id) {
                $result = WC()->cart->add_to_cart($product_id, $quantity);
                if ($result) {
                    $added_count++;
                }
            }
        }

        delete_transient('rca_session_' . $token);

        if ($added_count === 0) {
            wp_die('Aucun produit correspondant trouvé pour les prix: ' . implode(', ', array_column($line_items, 'unitPrice')), 'Erreur', ['response' => 400]);
        }

        $checkout_url = wc_get_checkout_url();
        wp_safe_redirect($checkout_url);
        exit;
    }

    private function find_product_by_price($price) {
        global $wpdb;

        $price = round($price, 2);
        $price_formatted = number_format($price, 2, '.', '');

        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT pm.post_id FROM {$wpdb->postmeta} pm
            INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE pm.meta_key = '_price'
            AND pm.meta_value = %s
            AND p.post_type IN ('product', 'product_variation')
            AND p.post_status = 'publish'
            LIMIT 1",
            $price_formatted
        ));

        if ($product_id) {
            return (int) $product_id;
        }

        $price_no_trailing = rtrim(rtrim($price_formatted, '0'), '.');
        if ($price_no_trailing !== $price_formatted) {
            $product_id = $wpdb->get_var($wpdb->prepare(
                "SELECT pm.post_id FROM {$wpdb->postmeta} pm
                INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
                WHERE pm.meta_key = '_price'
                AND pm.meta_value = %s
                AND p.post_type IN ('product', 'product_variation')
                AND p.post_status = 'publish'
                LIMIT 1",
                $price_no_trailing
            ));

            if ($product_id) {
                return (int) $product_id;
            }
        }

        $price_min = $price - 0.01;
        $price_max = $price + 0.01;

        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT pm.post_id FROM {$wpdb->postmeta} pm
            INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE pm.meta_key = '_price'
            AND CAST(pm.meta_value AS DECIMAL(10,2)) BETWEEN %f AND %f
            AND p.post_type IN ('product', 'product_variation')
            AND p.post_status = 'publish'
            LIMIT 1",
            $price_min,
            $price_max
        ));

        return $product_id ? (int) $product_id : null;
    }
}

new Remote_Checkout_API();

register_activation_hook(__FILE__, function() {
    add_rewrite_rule(
        '^remote-checkout/?$',
        'index.php?remote_checkout=1',
        'top'
    );
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
