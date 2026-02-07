"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2, Check, Truck } from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface ShippingSettingsProps {
  storeId: string
}

export function ShippingSettings({ storeId }: ShippingSettingsProps) {
  const [sectionTitle, setSectionTitle] = useState('')
  const [methodTitle, setMethodTitle] = useState('')
  const [methodSubtitle, setMethodSubtitle] = useState('')
  const [minDays, setMinDays] = useState(1)
  const [maxDays, setMaxDays] = useState(2)
  const [displayType, setDisplayType] = useState<'icon' | 'logo' | ''>('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingLoading, setFetchingLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function loadSettings() {
    try {
      setFetchingLoading(true)
      const store = await apiClient.stores.getById(storeId)

      if (store) {
        setSectionTitle(store.addressSectionTitle || '')
        setMethodTitle(store.shippingMethodTitle || '')
        setMethodSubtitle(store.shippingMethodSubtitle || '')
        setMinDays(store.shippingMinDays ?? 1)
        setMaxDays(store.shippingMaxDays ?? 2)
        setDisplayType((store.shippingDisplayType as 'icon' | 'logo' | '') || '')
        setImageUrl(store.shippingImageUrl || '')
      }
    } catch (err) {
      console.error('Error loading shipping settings:', err)
    } finally {
      setFetchingLoading(false)
    }
  }

  async function handleSave() {
    if (minDays < 0 || maxDays < 0) {
      setError('Les jours doivent être positifs')
      return
    }

    if (minDays > maxDays) {
      setError('Le minimum doit être inférieur ou égal au maximum')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.stores.update(storeId, {
        addressSectionTitle: sectionTitle || null,
        shippingMethodTitle: methodTitle || null,
        shippingMethodSubtitle: methodSubtitle || null,
        shippingMinDays: minDays,
        shippingMaxDays: maxDays,
        shippingDisplayType: displayType || null,
        shippingImageUrl: imageUrl || null,
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  // Preview helper
  function formatPreviewDate(daysFromNow: number): string {
    const date = new Date()
    let addedDays = 0
    while (addedDays < daysFromNow) {
      date.setDate(date.getDate() + 1)
      const dayOfWeek = date.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++
      }
    }
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
  }

  function getPreviewSubtitle(): string {
    const template = methodSubtitle || 'Entre le {{minDate}} et le {{maxDate}}'
    return template
      .replace('{{minDate}}', formatPreviewDate(minDays))
      .replace('{{maxDate}}', formatPreviewDate(maxDays))
  }

  if (fetchingLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuration Livraison</h1>
        <p className="text-gray-500">
          Personnalisez l&apos;affichage de la livraison sur le checkout
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Mode d&apos;expédition</h3>
            <p className="text-sm text-gray-500">Titre et délais affichés au client</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sectionTitle">Titre de la section</Label>
            <Input
              id="sectionTitle"
              type="text"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Livraison"
            />
            <p className="text-xs text-gray-500">Le titre affiché au-dessus du formulaire d&apos;adresse (ex: &quot;Livraison&quot;, &quot;Facturation&quot;, &quot;Adresse&quot;)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="methodTitle">Titre de la méthode</Label>
            <Input
              id="methodTitle"
              type="text"
              value={methodTitle}
              onChange={(e) => setMethodTitle(e.target.value)}
              placeholder="Livraison standard"
            />
            <p className="text-xs text-gray-500">Laissez vide pour utiliser &quot;Livraison standard&quot;</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="methodSubtitle">Sous-titre (délai)</Label>
            <Input
              id="methodSubtitle"
              type="text"
              value={methodSubtitle}
              onChange={(e) => setMethodSubtitle(e.target.value)}
              placeholder="Entre le {{minDate}} et le {{maxDate}}"
            />
            <p className="text-xs text-gray-500">
              Variables disponibles : <code className="bg-gray-100 px-1 rounded">{'{{minDate}}'}</code> et <code className="bg-gray-100 px-1 rounded">{'{{maxDate}}'}</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minDays">Jours minimum (ouvrés)</Label>
              <Input
                id="minDays"
                type="number"
                min={0}
                value={minDays}
                onChange={(e) => setMinDays(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDays">Jours maximum (ouvrés)</Label>
              <Input
                id="maxDays"
                type="number"
                min={0}
                value={maxDays}
                onChange={(e) => setMaxDays(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Logo/Icon config */}
          <div className="pt-4 border-t space-y-4">
            <div className="space-y-2">
              <Label>Image de la méthode</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDisplayType('')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    displayType === ''
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Aucune
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayType('icon')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    displayType === 'icon'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Icône (gauche)
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayType('logo')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    displayType === 'logo'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Logo (droite)
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Icône : petite image à gauche du texte • Logo : image à droite (remplace &quot;Gratuit&quot;)
              </p>
            </div>

            {displayType && (
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL de l&apos;image</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://exemple.com/logo.png"
                />
                <p className="text-xs text-gray-500">
                  {displayType === 'icon'
                    ? 'Recommandé : image carrée, 24x24px minimum'
                    : 'Recommandé : logo horizontal, max 120px de large'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium text-sm mb-3 text-gray-600">Aperçu sur le checkout :</h4>
          <div className="space-y-3">
            <h5 className="text-[21px] font-semibold text-gray-900">{sectionTitle || 'Livraison'}</h5>
            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-300 bg-white">
              <div className="flex items-center gap-4">
                <div className="w-[18px] h-[18px] rounded-full border-[5px] border-black bg-white" />
                {displayType === 'icon' && imageUrl && (
                  <img src={imageUrl} alt="" className="w-6 h-6 object-contain" />
                )}
                <div>
                  <p className="text-sm text-gray-900">{methodTitle || 'Livraison standard'}</p>
                  <p className="text-xs text-gray-500">{getPreviewSubtitle()}</p>
                </div>
              </div>
              {displayType === 'logo' && imageUrl ? (
                <img src={imageUrl} alt="" className="h-6 max-w-[120px] object-contain" />
              ) : (
                <span className="text-sm font-semibold text-gray-900">Gratuit</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>Paramètres sauvegardés !</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-black hover:bg-gray-900"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              'Sauvegarder'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
