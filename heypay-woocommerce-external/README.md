# HeyPay External Checkout for WooCommerce

Plugin ultra-simple pour rediriger le checkout WooCommerce vers un checkout externe hébergé (comme Shopify/TagadaPay).

## Installation

1. Uploader le plugin sur WordPress
2. Activer le plugin
3. C'est tout ! Le plugin auto-détecte le domaine

## Flow

```
1. Client arrive sur /checkout WooCommerce
2. Plugin intercepte (hook wp_head)
3. Appelle API HeyPay: POST /api/checkout/session/init
   Body: {
     domain: "concertclik.com",
     cartToken: "md5_hash",
     lineItems: [{externalProductId, externalVariantId, quantity}],
     returnUrl: "https://concertclik.com?heypay_success=1",
     customer: {currency, locale}
   }
4. API retourne: {checkoutUrl: "https://checkout-domain.com/xyz"}
5. Redirect vers checkoutUrl
6. Client paie sur checkout externe
7. Checkout externe redirige vers returnUrl
8. Plugin vide le panier WooCommerce
9. Client voit la confirmation
```

## OAuth WooCommerce (à implémenter côté Dashboard)

### Flow OAuth

```
1. User entre son domaine WordPress dans dashboard HeyPay
   Input: "concertclik.com"

2. Dashboard génère URL OAuth:
   https://concertclik.com/wc-auth/v1/login/?
     app_name=HeyPay&
     user_id={base64({accountId, storeId})}&
     return_url=https://app.heypay.one/stores/{storeId}/integration?provider=woocommerce&
     callback_url=https://api.heypay.one/api/public/oauth/woocommerce/callback&
     scope=read_write

3. User clique sur le lien → WordPress demande confirmation

4. User accepte → WordPress redirect vers callback_url:
   https://api.heypay.one/api/public/oauth/woocommerce/callback?
     user_id={base64_data}&
     consumer_key=ck_xxxxx&
     consumer_secret=cs_xxxxx&
     key_permissions=read_write&
     success=1

5. API HeyPay:
   - Décode user_id pour récupérer storeId
   - Stocke consumer_key + consumer_secret dans Store
   - Redirect vers return_url

6. Dashboard affiche les credentials enregistrés
```

### Paramètres OAuth

| Paramètre | Description |
|-----------|-------------|
| `app_name` | Nom de l'app (HeyPay) |
| `user_id` | Base64 de `{accountId, storeId}` pour identifier le store |
| `return_url` | URL où retourner l'user après OAuth |
| `callback_url` | URL où WooCommerce envoie les credentials |
| `scope` | `read_write` pour accès complet |

### Endpoints API à créer

#### `GET /api/public/oauth/woocommerce/callback`
Reçoit les credentials de WooCommerce après OAuth.

**Query params:**
- `user_id`: Base64 de `{accountId, storeId}`
- `consumer_key`: Client Key WooCommerce
- `consumer_secret`: Client Secret WooCommerce
- `key_permissions`: Permissions accordées
- `success`: 1 si succès

**Logic:**
```typescript
1. Decode user_id → get storeId
2. Validate storeId exists
3. Store credentials in database:
   Store.update({
     woocommerce: {
       domain: "concertclik.com",
       consumerKey: consumer_key,
       consumerSecret: consumer_secret,
       permissions: key_permissions,
       connectedAt: new Date()
     }
   })
4. Redirect to return_url
```

#### `POST /api/checkout/session/init`
Crée une session de checkout externe (détecte automatiquement WooCommerce via domain).

**Body:**
```json
{
  "domain": "concertclik.com",
  "cartToken": "abc123",
  "lineItems": [
    {
      "externalProductId": "123",
      "externalVariantId": "456",
      "quantity": 2
    }
  ],
  "returnUrl": "https://concertclik.com?heypay_success=1",
  "customer": {
    "currency": "EUR",
    "locale": "fr-FR"
  }
}
```

**Response:**
```json
{
  "checkoutUrl": "https://custom-checkout-domain.com/c/abc123xyz"
}
```

**Logic:**
```typescript
1. Find Store by domain
2. Get WooCommerce credentials from Store
3. Fetch product details from WooCommerce API using credentials
4. Create Checkout session in database
5. Generate checkoutUrl (sur domaine custom du store)
6. Return checkoutUrl
```

## WooCommerce REST API Usage

Avec les credentials OAuth, l'API HeyPay peut appeler WooCommerce REST API:

```bash
# Get product details
GET https://concertclik.com/wp-json/wc/v3/products/123
Authorization: Basic base64(consumer_key:consumer_secret)

# Create order (après paiement)
POST https://concertclik.com/wp-json/wc/v3/orders
Authorization: Basic base64(consumer_key:consumer_secret)
Body: {
  line_items: [...],
  customer_id: 1,
  payment_method: "heypay",
  set_paid: true
}
```

## Différences avec le plugin legacy

| Feature | Legacy (heypay-woocommerce-plugin) | External (ce plugin) |
|---------|-----------------------------------|---------------------|
| Checkout | Intégré sur la page WooCommerce | Redirect vers checkout externe |
| Payment | Stripe Elements sur place | Checkout hébergé |
| OAuth | Non requis | Requis pour récupérer produits |
| Commande WooCommerce | Créée automatiquement | Créée par API après paiement |
| Complexité | ~500 lignes | ~110 lignes |

## Structure de fichiers

```
heypay-woocommerce-external/
├── heypay-external-checkout.php  (plugin principal, 110 lignes)
└── README.md                      (cette doc)
```

Pas de assets, pas de settings UI, juste un fichier PHP ultra-simple.
