{/* <script>
(function(){
  const CHECKOUT_URL_BASE = "http://viralize-api.naiart.fr/checkouts/cn/"; // on concatène le checkoutId
  const CREATE_CHECKOUT_URL = "https://viralize-api.naiart.fr/api/checkout/create";

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset._html = btn.innerHTML;
      btn.innerHTML = `<span class="btn-spinner"></span>`;
      btn.disabled = true;
      btn.classList.add("is-loading");
    } else {
      if (btn.dataset._html) btn.innerHTML = btn.dataset._html;
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  }

  async function getCart(){
    const r = await fetch("/cart.js", { credentials: "same-origin" });
    if (!r.ok) throw new Error("cart fetch failed");
    return r.json();
  }

  // Appelle l'API pour obtenir le checkoutId (obligatoire)
  async function createCheckoutId(cartToken){
    const r = await fetch(CREATE_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // L'API côté serveur déduit payDomain, on envoie juste cartId
      body: JSON.stringify({ cartId: cartToken }),
      mode: "cors",
      credentials: "omit"
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.success || !data?.checkoutId) {
      const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
      throw new Error("Échec création checkout: " + msg);
    }
    try { sessionStorage.setItem("viralizeCheckoutId", data.checkoutId); } catch(e){}
    window.__viralizeCheckoutId = data.checkoutId;
    return data.checkoutId;
  }

  function buildCheckoutUrl(checkoutId) {
    return CHECKOUT_URL_BASE + encodeURIComponent(checkoutId);
  }

  async function go(btn){
    setLoading(btn, true);
    try {
      // 1) Vérifie le panier (on garde ton contrôle existant)
      const cart = await getCart();
      if (!cart.items?.length) {
        setLoading(btn, false);
        return true; // laisse le submit natif si tu veux
      }

      // 2) Récupère le token du panier à envoyer à l'API
      let cartToken = cart?.token || "";
      if (!cartToken) throw new Error("Token du panier introuvable");
      if (cartToken.includes("?")) cartToken = cartToken.split("?")[0];

      // 3) Appel API OBLIGATOIRE → on n'avance que si on a un checkoutId
      const checkoutId = await createCheckoutId(cartToken);

      // 4) Redirection via le checkoutId (aucun fallback sur le token Shopify)
      const target = buildCheckoutUrl(checkoutId);
      window.location.assign(target);
      return false;
    } catch(e){
      console.warn(e);
      alert("Impossible d'ouvrir le paiement. Merci de réessayer dans un instant.");
      setLoading(btn, false);
      return false; // on bloque le submit; aucun fallback
    }
  }

  document.addEventListener("click", async (e) => {
    const el = e.target.closest(
      'button[name="checkout"],button.cart__checkout-button,.cart__footer .checkout-button,.drawer__footer button[name="checkout"],a.checkout'
    );
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const allow = await go(el);
    if (allow) el.closest("form")?.submit?.();
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .shopify-payment-button,
    .shopify-payment-button__button,
    .shopify-payment-button__button--unbranded {
      display:none!important;
    }
    .is-loading {
      opacity:.85;
      pointer-events:none;
      display:flex!important;
      justify-content:center;
      align-items:center;
    }
    .btn-spinner {
      width:18px;
      height:18px;
      border:2px solid currentColor;
      border-top-color:transparent;
      border-radius:50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();
</script>
 */}