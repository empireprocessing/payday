<?php
/**
 * Plugin Name: HeyPay Checkout
 * Version: 1.0.3
 * Author: HeyPay
 * Author URI: https://heypay.one
 */

define("HEYPAY_ENDPOINT", "https://app.heypay.one");

function woocommerce_checkout_with_heypay() {
  if (!function_exists('WC')) {
    return new WP_Error('woocommerce_not_active', "WooCommerce is not active");
  }

  // Handle successful return - empty cart
  if (isset($_GET['heypay_success']) && $_GET['heypay_success'] == 1) {
    WC()->cart->empty_cart();
  }

  // Intercept checkout page
  if (is_checkout() && !is_checkout_pay_page()) {
    // Get cart token
    $cart_token = @$_COOKIE['wp_woocommerce_session_' . COOKIEHASH];
    if (!isset($cart_token)) {
      $cart_token = uniqid('wc_cart_', true);
    }

    // Get cart items
    $cart = WC()->cart->get_cart();

    $line_items = array_map(fn ($c) => [
      "quantity" => $c["quantity"],
      "externalVariantId" => $c["variation_id"],
      "externalProductId" => $c["product_id"]
    ], array_values($cart));

    // Get locale
    $locale = determine_locale();
    if (!isset($locale)) {
      $locale = get_user_locale();
    }

    // Get site domain (auto-detect)
    $site_domain = parse_url(get_site_url(), PHP_URL_HOST);

    // Prepare customer data
    $customer = [
      "currency" => get_woocommerce_currency(),
      "locale" => isset($locale) ? str_replace("_", "-", $locale) : null
    ];

    // Prepare request
    $request_body = [
      "domain" => $site_domain,
      "cartToken" => md5($cart_token),
      "lineItems" => $line_items,
      "returnUrl" => home_url(),
      "customer" => $customer
    ];

    // Call HeyPay API
    $stream_opts = [
      "http" => [
        "method" => "POST",
        "content" => json_encode($request_body),
        "header" => [
          "Content-type: application/json"
        ]
      ]
    ];

    $ctx = stream_context_create($stream_opts);
    $content = file_get_contents(
      HEYPAY_ENDPOINT . "/api/checkout/session/init",
      false,
      $ctx
    );

    if ($content == false) {
      return new WP_Error("heypay_checkout_failed", "Failed to initiate checkout");
    }

    $checkout = json_decode($content, true);

?>
  <p>Going to <?= $checkout["checkoutUrl"] ?></p>
<?php

    header("Location: " . $checkout["checkoutUrl"]);
    exit(0);
  }

?>
  <script>
    if (typeof URLSearchParams === 'function' && /heypay_success/.test(location.search)) {
      const params = new URLSearchParams(location.search);
      params.delete('heypay_success');

      location.search = params.size > 0
        ? `?${params.toString()}`
        : '';
    }
  </script>
<?php
}

// https://developer.wordpress.org/reference/hooks/wp_head/
add_action('wp_head', 'woocommerce_checkout_with_heypay');
?>
