# HeyPay Payment Gateway for WooCommerce

Plugin de paiement WooCommerce intégrant **HeyPay** avec routage intelligent et cascading automatique entre plusieurs PSP Stripe.

## 🚀 Fonctionnalités

- ✅ **Configuration ZÉRO** : Détection automatique du domaine, aucune API Key à configurer
- ✅ **Cascading automatique** : Si un PSP échoue, le système essaie automatiquement le suivant
- ✅ **Routage intelligent** : Sélection du meilleur PSP basé sur la capacité et l'usage
- ✅ **Intégration native** : Paiement directement sur la page WooCommerce (pas de redirection)
- ✅ **Stripe Elements** : Formulaire de carte sécurisé et optimisé
- ✅ **Support Apple Pay & Google Pay** : Paiements express activés automatiquement
- ✅ **API cachée** : Le client ne voit jamais l'API HeyPay (WordPress sert de proxy)

## 📋 Prérequis

- WordPress 5.8+
- WooCommerce 6.0+
- PHP 7.4+
- Un compte HeyPay avec votre store configuré
- Au moins un PSP Stripe configuré dans votre dashboard HeyPay

## 📦 Installation

### 1. Télécharger le plugin

Copiez le dossier `heypay-woocommerce-plugin` dans `/wp-content/plugins/` de votre site WordPress.

```bash
# Depuis votre serveur WordPress
cd /path/to/wordpress/wp-content/plugins/
cp -r /path/to/heypay-woocommerce-plugin ./heypay-payment-gateway
```

### 2. Activer le plugin

1. Connectez-vous à votre dashboard WordPress
2. Allez dans **Extensions** → **Extensions installées**
3. Trouvez "HeyPay Payment Gateway" et cliquez sur **Activer**

### 3. Configurer votre store dans HeyPay Dashboard

**IMPORTANT** : Avant d'utiliser le plugin, ajoutez votre boutique dans le dashboard HeyPay :

1. Connectez-vous à [https://app.heypay.one](https://app.heypay.one)
2. Allez dans **Boutiques** → **Ajouter une boutique**
3. Renseignez le **domaine de votre site** (ex: `maboutique.com`)
4. Configurez au moins un PSP Stripe pour cette boutique

### 4. Configurer le plugin (optionnel)

1. Allez dans **WooCommerce** → **Réglages** → **Paiements**
2. Activez **HeyPay** et cliquez sur **Gérer**

#### Configuration disponible :

| Champ | Description | Défaut |
|-------|-------------|--------|
| **Titre** | Nom affiché au client | `Credit Card / Debit Card` |
| **Description** | Description affichée au client | `Pay securely...` |
| **API URL** | URL de l'API HeyPay | `https://api.heypay.one` |
| **Auto-detected Domain** | Votre domaine (détecté automatiquement) | Ex: `maboutique.com` |

**Note** : Le domaine est détecté automatiquement, vous n'avez rien à configurer ! Assurez-vous juste qu'il correspond bien au domaine configuré dans votre dashboard HeyPay.

### 5. Testez !

1. Ajoutez un produit au panier
2. Allez au checkout
3. Sélectionnez "Credit Card / Debit Card"
4. Le formulaire Stripe Elements devrait apparaître 🎉

## 📊 Comment ça marche ?

### Flow de paiement

```
1. Client clique "Commander" sur maboutique.com
   ↓
2. Plugin détecte automatiquement le domaine : "maboutique.com"
   ↓
3. Plugin appelle l'API HeyPay (en backend, invisible pour le client)
   → POST /payment/woocommerce/intent
   → Envoie: { domain: "maboutique.com", amount: 50, currency: "EUR", ... }
   ↓
4. HeyPay trouve le store via le domaine
   → await Store.findUnique({ where: { domain: "maboutique.com" } })
   ↓
5. HeyPay sélectionne le meilleur PSP automatiquement
   → Balance de charge basée sur capacité et usage
   ↓
6. HeyPay crée un PaymentIntent Stripe avec cascading
   → Si PSP #1 échoue → essai automatique sur PSP #2, #3, etc.
   → Retourne: clientSecret + publishableKey
   ↓
7. Plugin monte Stripe Elements dans la page
   → Client entre sa carte (sécurisé via Stripe)
   ↓
8. Client valide → Stripe confirme le paiement
   ↓
9. Plugin appelle API HeyPay pour confirmer
   → POST /payment/confirm
   ↓
10. Commande WooCommerce validée ✅
```

### Cascading automatique

Si le 1er PSP échoue, HeyPay essaie automatiquement le suivant :

```
Tentative 1: PSP #1 → ❌ Échec (capacité dépassée)
Tentative 2: PSP #2 → ❌ Échec (erreur Stripe)
Tentative 3: PSP #3 → ✅ Succès !
```

Le client ne voit qu'un seul message : "Paiement en cours..."

## 🔒 Sécurité

### API cachée

Le client (navigateur) ne voit **JAMAIS** l'API HeyPay :

**Ce que voit le client dans Network :**
```
✅ POST /wp-admin/admin-ajax.php?action=heypay_create_payment_intent
✅ https://js.stripe.com/v3/
✅ POST https://api.stripe.com/v1/payment_methods
❌ Aucune trace de api.heypay.one
```

WordPress sert de **proxy** entre le client et HeyPay.

### Conformité PCI DSS

- ✅ Les données de carte transitent directement vers Stripe (jamais par votre serveur)
- ✅ Stripe Elements gère la tokenisation sécurisée
- ✅ Aucune donnée sensible stockée dans WordPress

## 🐛 Dépannage

### Le formulaire de carte ne s'affiche pas

**Causes possibles :**
1. Stripe.js bloqué par un bloqueur de publicités
2. JavaScript désactivé
3. Conflit avec un autre plugin de paiement

**Solution :**
- Ouvrez la console navigateur (F12) et vérifiez les erreurs
- Désactivez temporairement les autres plugins de paiement

### "Store non trouvé pour le domaine: maboutique.com"

**Cause :** Votre domaine n'est pas configuré dans le dashboard HeyPay

**Solution :**
1. Vérifiez le domaine détecté dans WooCommerce → Réglages → Paiements → HeyPay
2. Connectez-vous au [Dashboard HeyPay](https://app.heypay.one)
3. Allez dans **Boutiques** et vérifiez que votre domaine est bien enregistré
4. Si absent, créez une nouvelle boutique avec le domaine exact : `maboutique.com`
5. **Important** : N'ajoutez PAS "www." si votre site n'en a pas (et inversement)

**Exemples** :
- ✅ Site : `https://maboutique.com` → Dashboard : `maboutique.com`
- ✅ Site : `https://www.maboutique.com` → Dashboard : `www.maboutique.com`
- ❌ Site : `https://maboutique.com` → Dashboard : `www.maboutique.com` (INCORRECT)

### "Aucun PSP configuré pour ce store"

**Cause :** Aucun PSP Stripe n'est lié à votre store dans HeyPay

**Solution :**
1. Connectez-vous au dashboard HeyPay
2. Allez dans **Boutiques** → Sélectionnez votre boutique
3. Ajoutez au moins un PSP Stripe dans l'onglet **PSP**

### Le domaine détecté n'est pas correct

**Cause :** WordPress détecte le mauvais domaine (peut arriver avec proxy/CDN)

**Solution :**
1. Vérifiez votre configuration WordPress (Réglages → Général)
2. Assurez-vous que "Adresse web de WordPress" et "Adresse web du site" sont corrects
3. Si vous utilisez Cloudflare ou un CDN, vérifiez la configuration

### Paiement réussi mais commande reste "en attente"

**Cause :** L'endpoint `/payment/confirm` a échoué

**Solution :**
- Vérifiez les logs WordPress : `wp-content/debug.log`
- Vérifiez que l'API URL est correcte dans les settings
- Contactez le support HeyPay

## 🎯 Avantages de l'approche zéro-config

### Pour le merchant :

- ✅ **Installation en 2 minutes** : Upload ZIP → Activer → Terminé
- ✅ **Pas d'API Key à gérer** : Le domaine suffit
- ✅ **Pas de risque de fuite** : Aucun secret stocké dans WordPress
- ✅ **Multi-domaines facile** : Chaque domaine pointe vers son store automatiquement

### Pour vous (développeur HeyPay) :

- ✅ **Sécurité renforcée** : Pas de clés exposées
- ✅ **Support simplifié** : Moins de problèmes de configuration
- ✅ **Contrôle centralisé** : Tout se gère dans le dashboard HeyPay

## 📞 Support

- Documentation : [https://docs.heypay.one](https://docs.heypay.one)
- Support : support@heypay.one
- Dashboard : [https://app.heypay.one](https://app.heypay.one)

## 📝 Changelog

### Version 1.0.0
- Release initiale
- Détection automatique du domaine (zéro-config)
- Support du cascading automatique
- Intégration Stripe Elements
- Support Apple Pay / Google Pay

## 📄 Licence

GPL v2 ou supérieure
