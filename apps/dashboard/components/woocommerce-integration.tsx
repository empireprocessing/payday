"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ExternalLink, Check, AlertCircle, Loader2, Copy, CheckCircle, Settings, Zap } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { StorePlatform } from "@/lib/types"

interface WooCommerceIntegrationProps {
  storeId: string
}

interface WooCommerceConfig {
  domain?: string
  consumerKey?: string
  consumerSecret?: string
  permissions?: string
  connectedAt?: string
}

type ConfigMode = 'oauth' | 'manual'

export function WooCommerceIntegration({ storeId }: WooCommerceIntegrationProps) {
  const [mode, setMode] = useState<ConfigMode>('oauth')
  const [domain, setDomain] = useState('')
  const [manualConsumerKey, setManualConsumerKey] = useState('')
  const [manualConsumerSecret, setManualConsumerSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')
  const [credentials, setCredentials] = useState<WooCommerceConfig | null>(null)
  const [copied, setCopied] = useState(false)

  // Vérifier si déjà connecté au chargement
  useEffect(() => {
    checkConnection()
  }, [])

  // Vérifier le paramètre success dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      checkConnection()
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function checkConnection() {
    try {
      const data = await apiClient.woocommerce.getCredentials(storeId)

      if (data.platform === 'WOOCOMMERCE' && data.platformConfig) {
        const config = data.platformConfig as WooCommerceConfig
        // Vérifier si les credentials OAuth sont présents
        if (config.consumerKey && config.consumerSecret) {
          setCredentials(config)
          setDomain(config.domain || data.domain)
        } else {
          // Pas encore de credentials OAuth
          setDomain(data.domain)
        }
      }
    } catch (err) {
      console.error('Error checking connection:', err)
    }
  }

  async function handleGenerateOAuth() {
    if (!domain) {
      setError('Veuillez entrer un domaine')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await apiClient.woocommerce.generateOAuthUrl({
        domain: domain.replace(/^https?:\/\//, ''), // Nettoyer le domaine
        storeId,
        accountId: 'acc_demo', // TODO: récupérer depuis le contexte user
      })

      if (data.success && data.oauthUrl) {
        setOauthUrl(data.oauthUrl)
        // Rediriger directement vers l'OAuth
        window.location.href = data.oauthUrl
      } else {
        setError(data.error || 'Erreur lors de la génération du lien OAuth')
      }
    } catch {
      setError('Erreur de connexion à l\'API')
    } finally {
      setLoading(false)
    }
  }

  async function handleManualSave() {
    if (!domain) {
      setError('Veuillez entrer un domaine')
      return
    }
    if (!manualConsumerKey) {
      setError('Veuillez entrer la Consumer Key')
      return
    }
    if (!manualConsumerSecret) {
      setError('Veuillez entrer la Consumer Secret')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.stores.update(storeId, {
        domain: domain.replace(/^https?:\/\//, ''),
        platform: StorePlatform.WOOCOMMERCE,
        platformConfig: {
          domain: domain.replace(/^https?:\/\//, ''),
          consumerKey: manualConsumerKey,
          consumerSecret: manualConsumerSecret,
          connectedAt: new Date().toISOString(),
        },
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      // Recharger les credentials
      await checkConnection()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Intégration WooCommerce</h2>
        <p className="text-muted-foreground">
          Connectez votre boutique WooCommerce pour activer le checkout externe HeyPay.
        </p>
      </div>

      {!credentials ? (
        <Card className="glassmorphism p-6">
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => { setMode('oauth'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  mode === 'oauth'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="h-4 w-4" />
                OAuth (Auto)
              </button>
              <button
                type="button"
                onClick={() => { setMode('manual'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  mode === 'manual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings className="h-4 w-4" />
                Manuel
              </button>
            </div>

            {/* Domain input (common to both modes) */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                  1
                </span>
                Entrez votre domaine WooCommerce
              </h3>
              <Input
                type="text"
                placeholder="exemple.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="glassmorphism"
                disabled={loading}
              />
            </div>

            {mode === 'oauth' ? (
              /* OAuth Mode */
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                    2
                  </span>
                  Connectez-vous à WooCommerce
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Vous serez redirigé vers votre site WordPress pour autoriser HeyPay à accéder à votre boutique.
                </p>
                <Button
                  onClick={handleGenerateOAuth}
                  disabled={loading || !domain}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération du lien...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connecter WooCommerce
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Manual Mode */
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                      2
                    </span>
                    Entrez vos clés API WooCommerce
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez des clés API dans WooCommerce &gt; Réglages &gt; Avancé &gt; REST API
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Consumer Key</label>
                    <Input
                      type="text"
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={manualConsumerKey}
                      onChange={(e) => setManualConsumerKey(e.target.value)}
                      className="glassmorphism font-mono text-sm"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Consumer Secret</label>
                    <Input
                      type="password"
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={manualConsumerSecret}
                      onChange={(e) => setManualConsumerSecret(e.target.value)}
                      className="glassmorphism font-mono text-sm"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleManualSave}
                  disabled={loading || !domain || !manualConsumerKey || !manualConsumerSecret}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Sauvegarder la configuration
                    </>
                  )}
                </Button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle className="h-4 w-4" />
                Configuration sauvegardée !
              </div>
            )}

            {mode === 'oauth' && oauthUrl && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">
                  Si vous n&apos;êtes pas redirigé automatiquement :
                </p>
                <a
                  href={oauthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-2"
                >
                  Cliquez ici pour continuer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="glassmorphism p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-500 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">WooCommerce connecté</h3>
                <p className="text-sm text-muted-foreground">
                  {credentials.connectedAt && `Connecté le ${new Date(credentials.connectedAt).toLocaleDateString('fr-FR')}`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Domaine</label>
                <div className="glassmorphism p-3 rounded-lg text-sm">
                  {credentials.domain || 'Non configuré'}
                </div>
              </div>

              {credentials.consumerKey && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Consumer Key</label>
                  <div className="flex gap-2">
                    <div className="glassmorphism p-3 rounded-lg text-sm flex-1 font-mono">
                      {credentials.consumerKey.substring(0, 20)}...
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(credentials.consumerKey!)}
                      className="glassmorphism"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {credentials.consumerSecret && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Consumer Secret</label>
                  <div className="flex gap-2">
                    <div className="glassmorphism p-3 rounded-lg text-sm flex-1 font-mono">
                      ••••••••••••••••••••
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(credentials.consumerSecret!)}
                      className="glassmorphism"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold mb-2">Installation du plugin</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Téléchargez et installez le plugin HeyPay Checkout sur votre site WordPress pour activer le checkout externe.
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <a href="/heypay-external-checkout.zip" download>
                    Télécharger le plugin HeyPay Checkout
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Version 1.0.3 - Compatible WooCommerce 5.0+
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => {
                  setCredentials(null)
                  setDomain('')
                  setOauthUrl('')
                  setManualConsumerKey('')
                  setManualConsumerSecret('')
                }}
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                Déconnecter WooCommerce
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="glassmorphism p-6">
        <h3 className="font-semibold mb-3">Comment ça fonctionne ?</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
              1
            </span>
            <p>Connectez votre boutique WooCommerce via OAuth pour permettre à HeyPay d&apos;accéder aux produits.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
              2
            </span>
            <p>Installez le plugin HeyPay Checkout sur votre site WordPress.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
              3
            </span>
            <p>Vos clients seront automatiquement redirigés vers le checkout HeyPay lors du paiement.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
              4
            </span>
            <p>Les commandes seront créées automatiquement dans WooCommerce après paiement réussi.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
