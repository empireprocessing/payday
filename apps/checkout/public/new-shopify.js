<script>
(function(){
  const CHECKOUT_URL_BASE = "https://testcheckout.heypay.one/checkouts/cn/"; // ⚠️ HTTPS
  const CREATE_CHECKOUT_URL = "https://testcheckout.heypay.one/api/checkout/create";
  const FETCH_TIMEOUT_MS = 10000; // 10s
  let inFlight = false; // anti double-départ

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

  function withTimeout(promise, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    return Promise.race([
      (async () => {
        try { return await promise(controller.signal); }
        finally { clearTimeout(t); }
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms + 10))
    ]);
  }

  async function getCart(){
    return withTimeout(async (signal) => {
      const r = await fetch("/cart.js", { credentials: "same-origin", signal });
      if (!r.ok) throw new Error("cart fetch failed");
      return r.json();
    }, FETCH_TIMEOUT_MS);
  }

  async function createCheckoutId(cartToken){
    return withTimeout(async (signal) => {
      const r = await fetch(CREATE_CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cartToken }),
        mode: "cors",
        credentials: "omit",
        signal
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.success || !data?.checkoutId) {
        const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
        throw new Error("Échec création checkout: " + msg);
      }
      try { sessionStorage.setItem("viralizeCheckoutId", data.checkoutId); } catch(e){}
      window.__viralizeCheckoutId = data.checkoutId;
      return data.checkoutId;
    }, FETCH_TIMEOUT_MS);
  }

  function buildCheckoutUrl(checkoutId) {
    return CHECKOUT_URL_BASE + encodeURIComponent(checkoutId);
  }

  function termsAccepted() {
    const cb = document.querySelector('input[name="accept_terms"], input#CartAgree, input[name="terms"]');
    return !cb || cb.checked;
  }

  async function go(btn){
    if (inFlight) return false; // déjà en cours
    inFlight = true;
    setLoading(btn, true);
    try {
      if (!termsAccepted()) { setLoading(btn, false); inFlight = false; return true; }

      const cart = await getCart();
      if (!cart.items?.length) {
        setLoading(btn, false);
        inFlight = false;
        return true; // laisse le submit natif si panier vide
      }

      let cartToken = cart?.token || "";
      if (!cartToken) throw new Error("Token du panier introuvable");
      if (cartToken.includes("?")) cartToken = cartToken.split("?")[0];

      const checkoutId = await createCheckoutId(cartToken);
      const target = buildCheckoutUrl(checkoutId);
      window.location.assign(target);
      return false;
    } catch(e){
      console.warn(e);
      alert("Impossible d'ouvrir le paiement pour le moment. Réessaie dans quelques secondes.");
      setLoading(btn, false);
      return false;
    } finally {
      inFlight = false;
    }
  }

  // Intercepte clics sur boutons “checkout”
  document.addEventListener("click", async (e) => {
    const el = e.target.closest(
      'button[name="checkout"],button.cart__checkout-button,.cart__footer .checkout-button,.drawer__footer button[name="checkout"],a.checkout'
    );
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const allow = await go(el);
    if (allow) el.closest("form")?.submit?.();
  }, true);

  // Intercepte aussi la soumission clavier (Entrée)
  document.addEventListener("submit", async (e) => {
    const hasCheckoutBtn = e.target?.querySelector?.('button[name="checkout"],[name="checkout"]');
    if (!hasCheckoutBtn) return;
    e.preventDefault(); e.stopPropagation();
    const submitBtn = e.target.querySelector('button[name="checkout"],[name="checkout"]') || e.submitter;
    const allow = await go(submitBtn);
    if (allow) e.target.submit();
  }, true);

  // Masque les express (si tu veux forcer ton checkout)
  const style = document.createElement("style");
  style.textContent = `
    .shopify-payment-button,
    .shopify-payment-button__button,
    .shopify-payment-button__button--unbranded { display:none!important; }
    .is-loading { opacity:.85; pointer-events:none; display:flex!important; justify-content:center; align-items:center; }
    .btn-spinner { width:18px; height:18px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();
</script>