jQuery(document).ready(function ($) {
    let stripe = null;
    let elements = null;
    let cardNumberElement = null;
    let cardExpiryElement = null;
    let cardCvcElement = null;
    let isSubmitting = false;
    let stripeInitialized = false;
    const checkoutForm = $('form.checkout');

    /**
     * Handle 3DS confirmation with parsed hash data
     * Called from hashchange listener with already-parsed parts
     */
    function handleThreeDSConfirmation(parts) {
        const clientSecret = parts[0];
        const returnUrl = decodeURIComponent(parts[1]);
        const orderId = parts[2];
        // publishableKey is everything after the 3rd ':' (can contain ':' itself)
        const publishableKey = parts.slice(3).join(':');

        // Show loading overlay
        $('body').block({
            message: '<div style="padding: 20px;">🔐 Authenticating your payment...<br>Please complete the verification.</div>',
            overlayCSS: {
                background: '#fff',
                opacity: 0.9
            }
        });

        // Confirm payment with Stripe using the publishableKey from hash
        if (!publishableKey) {
            alert('Payment configuration error. Please contact support.');
            $('body').unblock();
            return;
        }

        const stripeInstance = Stripe(publishableKey);

        stripeInstance.confirmCardPayment(clientSecret).then(function(result) {
            if (result.error) {
                // 3DS failed
                $('body').unblock();

                // Show error message
                $('.woocommerce-error, .woocommerce-message').remove();
                $('form.checkout').prepend(
                    '<div class="woocommerce-error" role="alert">' +
                    '<strong>Payment authentication failed:</strong> ' + result.error.message +
                    '</div>'
                );

                $('html, body').animate({ scrollTop: 0 }, 500);

            } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                // 3DS succeeded
                // Call server to complete the order
                $.ajax({
                    type: 'POST',
                    url: heypayData.ajaxUrl,
                    data: {
                        action: 'heypay_confirm_payment',
                        nonce: heypayData.nonce,
                        order_id: orderId,
                        payment_intent_id: result.paymentIntent.id
                    },
                    success: function(response) {
                        if (response.success) {
                            // Redirect to thank you page
                            window.location.href = returnUrl;
                        } else {
                            $('body').unblock();
                            alert('Payment succeeded but order confirmation failed. Please contact support with order #' + orderId);
                        }
                    },
                    error: function(xhr) {
                        $('body').unblock();
                        alert('Server error. Please contact support with order #' + orderId);
                    }
                });
            } else {
                // Unexpected status
                $('body').unblock();
                alert('Payment status unclear. Please contact support with order #' + orderId);
            }
        }).catch(function(error) {
            $('body').unblock();
            alert('Payment processing error. Please try again.');
        });
    }

    /**
     * Check for 3DS confirmation hash in URL (like FunnelKit)
     * Format: #heypay-confirm-pi-{clientSecret}:{returnUrl}:{orderId}:{publishableKey}
     * Called on page load to check if hash is already present
     */
    function check3DSHash() {
        const hash = window.location.hash;

        if (!hash || hash.indexOf('#heypay-confirm-pi-') !== 0) {
            return;
        }

        // Parse hash: #heypay-confirm-pi-{clientSecret}:{returnUrl}:{orderId}:{publishableKey}
        const hashContent = hash.substring('#heypay-confirm-pi-'.length);
        const parts = hashContent.split(':');

        if (parts.length < 4) {
            return;
        }

        // Clean up URL first (we already have the parts)
        history.pushState({}, '', window.location.pathname + window.location.search);

        // Handle 3DS confirmation
        handleThreeDSConfirmation(parts);
    }

    // Check for 3DS hash on page load (with slight delay to ensure hash is loaded)
    setTimeout(function() {
        check3DSHash();
    }, 100);

    // Listen for hash changes - like FunnelKit, use window.addEventListener
    // This triggers when WooCommerce AJAX adds the hash to the URL after payment processing
    window.addEventListener('hashchange', function() {
        // IMPORTANT: Save the hash BEFORE cleaning the URL (like FunnelKit)
        const hash = window.location.hash;

        if (hash && hash.indexOf('#heypay-confirm-pi-') === 0) {
            // Parse the hash data before cleaning URL
            const hashContent = hash.substring('#heypay-confirm-pi-'.length);
            const parts = hashContent.split(':');

            if (parts.length < 4) {
                return;
            }

            // Clean up the URL history AFTER parsing
            history.pushState({}, '', window.location.pathname + window.location.search);

            // Now handle 3DS with the parsed data
            handleThreeDSConfirmation(parts);
        }
    });

    /**
     * Check if payment method already exists (like FunnelKit hasSource)
     */
    function hasPaymentMethod() {
        const pmElement = $('input[name="heypay_payment_method"]');
        if (pmElement.length > 0) {
            return pmElement.val();
        }
        return '';
    }

    /**
     * Add payment method to form (like FunnelKit appendMethodId)
     */
    function appendPaymentMethod(paymentMethodId, sessionId) {
        // Remove existing fields first
        $('input[name="heypay_payment_method"]').remove();
        $('input[name="heypay_session_id"]').remove();

        // Append new hidden fields
        checkoutForm.append(
            $('<input>').attr({
                type: 'hidden',
                name: 'heypay_payment_method',
                value: paymentMethodId
            })
        );
        checkoutForm.append(
            $('<input>').attr({
                type: 'hidden',
                name: 'heypay_session_id',
                value: sessionId
            })
        );
    }

    /**
     * Initialize Stripe with the publishable key from server
     * Like FunnelKit - uses separate card fields
     */
    function initializeStripe() {
        const selectedMethod = $('input[name="payment_method"]:checked').val();
        if (selectedMethod !== 'heypay') {
            return;
        }

        // Check if credentials were loaded from server
        if (!heypayData.publishableKey) {
            alert(heypayData.error || '⚠️ Payment system configuration error. Please contact support.');
            return;
        }

        // Only create Stripe instance and elements once
        if (!stripe) {
            stripe = Stripe(heypayData.publishableKey);
            elements = stripe.elements();

            // Create separate card elements (like FunnelKit)
            const elementStyle = {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            };

            cardNumberElement = elements.create('cardNumber', {
                style: elementStyle,
                showIcon: true
            });
            cardExpiryElement = elements.create('cardExpiry', { style: elementStyle });
            cardCvcElement = elements.create('cardCvc', { style: elementStyle });

            // Handle real-time validation errors for each field
            cardNumberElement.on('change', function(event) {
                const displayError = document.getElementById('heypay-card-number-errors');
                const generalError = document.getElementById('heypay-card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    generalError.textContent = '';
                } else {
                    displayError.textContent = '';
                }
            });

            cardExpiryElement.on('change', function(event) {
                const displayError = document.getElementById('heypay-card-expiry-errors');
                const generalError = document.getElementById('heypay-card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    generalError.textContent = '';
                } else {
                    displayError.textContent = '';
                }
            });

            cardCvcElement.on('change', function(event) {
                const displayError = document.getElementById('heypay-card-cvc-errors');
                const generalError = document.getElementById('heypay-card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    generalError.textContent = '';
                } else {
                    displayError.textContent = '';
                }
            });
        }

        // Mount the elements (can be called multiple times safely)
        mountStripeElements();
    }

    /**
     * Mount Stripe Elements into DOM
     * Called on init and after each updated_checkout event
     */
    function mountStripeElements() {
        if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
            return;
        }

        const cardNumberContainer = document.getElementById('heypay-card-number');
        const cardExpiryContainer = document.getElementById('heypay-card-expiry');
        const cardCvcContainer = document.getElementById('heypay-card-cvc');

        // Check if containers exist and are visible
        if (cardNumberContainer && cardNumberContainer.offsetHeight > 0) {
            // Only mount if not already mounted (Stripe will throw error if already mounted)
            if (!cardNumberContainer.querySelector('.StripeElement')) {
                cardNumberElement.mount('#heypay-card-number');
            }
            if (!cardExpiryContainer.querySelector('.StripeElement')) {
                cardExpiryElement.mount('#heypay-card-expiry');
            }
            if (!cardCvcContainer.querySelector('.StripeElement')) {
                cardCvcElement.mount('#heypay-card-cvc');
            }
            stripeInitialized = true;
        }
    }

    /**
     * Handle payment method selection
     */
    $(document.body).on('payment_method_selected', function () {
        initializeStripe();
    });

    $('form.checkout').on('change', 'input[name="payment_method"]', function () {
        if ($(this).val() === 'heypay') {
            initializeStripe();
        }
    });

    /**
     * Handle WooCommerce checkout updates (address changes, shipping changes, etc.)
     * Like FunnelKit - remount elements after each update
     */
    $(document.body).on('updated_checkout', function () {
        const selectedMethod = $('input[name="payment_method"]:checked').val();
        if (selectedMethod === 'heypay') {
            mountStripeElements();
        }
    });

    // Initialize on page load if HeyPay is already selected
    if ($('input[name="payment_method"]:checked').val() === 'heypay') {
        initializeStripe();
    }

    /**
     * Handle checkout errors - clean up payment method fields
     * Like FunnelKit - prevents stale payment methods from being reused
     */
    $(document).on('checkout_error', function () {
        $('input[name="heypay_payment_method"]').remove();
        $('input[name="heypay_session_id"]').remove();
        isSubmitting = false;
    });

    /**
     * Handle checkout form submission
     * Using WooCommerce's official checkout_place_order hook (like FunnelKit)
     */
    checkoutForm.on('checkout_place_order_heypay', function (e) {
        // Check if we already have a payment method (2nd pass after creating PM)
        // Like FunnelKit: if hasSource returns something, let submission continue
        const paymentMethod = hasPaymentMethod();

        if ('' !== paymentMethod) {
            // Don't do anything - let WooCommerce continue naturally
            return;
        }

        // First pass - need to create payment method
        if (isSubmitting) {
            e.preventDefault();
            return false;
        }

        if (!stripe || !cardNumberElement || !stripeInitialized) {
            alert('⚠️ Payment system not ready. Please refresh the page.');
            e.preventDefault();
            return false;
        }

        if (!heypayData.sessionId) {
            alert('⚠️ Payment session expired. Please refresh the page.');
            e.preventDefault();
            return false;
        }

        // Prevent default submission while we create the payment method
        e.preventDefault();
        isSubmitting = true;

        // Show loading state
        checkoutForm.addClass('processing').block({
            message: null,
            overlayCSS: {
                background: '#fff',
                opacity: 0.6
            }
        });

        // Step 1: Create Payment Method with Stripe (using cardNumber element)
        stripe.createPaymentMethod({
            type: 'card',
            card: cardNumberElement,
            billing_details: {
                name: $('#billing_first_name').val() + ' ' + $('#billing_last_name').val(),
                email: $('#billing_email').val(),
                phone: $('#billing_phone').val(),
                address: {
                    line1: $('#billing_address_1').val(),
                    line2: $('#billing_address_2').val(),
                    city: $('#billing_city').val(),
                    state: $('#billing_state').val(),
                    postal_code: $('#billing_postcode').val(),
                    country: $('#billing_country').val()
                }
            }
        }).then(function (result) {
            if (result.error) {
                // Show error
                $('#heypay-card-errors').text(result.error.message);
                checkoutForm.removeClass('processing').unblock();
                isSubmitting = false;
            } else {
                // Step 2: Add payment method ID and session ID to form (like FunnelKit appendMethodId)
                appendPaymentMethod(result.paymentMethod.id, heypayData.sessionId);

                // Step 3: Re-trigger checkout submission (like FunnelKit)
                isSubmitting = false;

                // IMPORTANT: Must unblock before re-triggering
                checkoutForm.removeClass('processing').unblock();

                checkoutForm.trigger('submit');
            }
        }).catch(function(error) {
            alert('⚠️ Payment processing error. Please try again.');
            checkoutForm.removeClass('processing').unblock();
            isSubmitting = false;
        });

        return false;
    });
});
