"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2, Check, Shield, Plus, Trash2, GripVertical, ImageIcon } from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface TrustBadge {
  icon: string
  imageUrl?: string
  title: string
  subtitle: string
}

interface TrustpilotConfig {
  enabled: boolean
  rating: string
  reviewCount: string
  url: string
}

interface TrustBadgesSettingsProps {
  storeId: string
}

// Emojis suggérés pour les badges
const SUGGESTED_ICONS = ['✅', '🛡️', '🚚', '💳', '🔒', '⭐', '🎁', '📦', '💯', '🏆', '❤️', '🔄']

export function TrustBadgesSettings({ storeId }: TrustBadgesSettingsProps) {
  const [badges, setBadges] = useState<TrustBadge[]>([])
  const [trustpilot, setTrustpilot] = useState<TrustpilotConfig>({
    enabled: false,
    rating: '',
    reviewCount: '',
    url: ''
  })
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

      if (store?.trustBadges && Array.isArray(store.trustBadges)) {
        setBadges(store.trustBadges)
      }

      // Load Trustpilot config
      setTrustpilot({
        enabled: store?.trustpilotEnabled || false,
        rating: store?.trustpilotRating?.toString() || '',
        reviewCount: store?.trustpilotReviewCount?.toString() || '',
        url: store?.trustpilotUrl || ''
      })
    } catch (err) {
      console.error('Error loading trust badges:', err)
    } finally {
      setFetchingLoading(false)
    }
  }

  function addBadge() {
    setBadges([...badges, { icon: '✅', imageUrl: '', title: '', subtitle: '' }])
  }

  function removeBadge(index: number) {
    setBadges(badges.filter((_, i) => i !== index))
  }

  function updateBadge(index: number, field: keyof TrustBadge, value: string) {
    const newBadges = [...badges]
    newBadges[index] = { ...newBadges[index], [field]: value }
    setBadges(newBadges)
  }

  async function handleSave() {
    // Validation
    const invalidBadge = badges.find(b => !b.title.trim())
    if (invalidBadge) {
      setError('Chaque badge doit avoir un titre')
      return
    }

    // Validate Trustpilot if enabled
    if (trustpilot.enabled) {
      const rating = parseFloat(trustpilot.rating)
      if (isNaN(rating) || rating < 0 || rating > 5) {
        setError('La note Trustpilot doit être entre 0 et 5')
        return
      }
      const reviewCount = parseInt(trustpilot.reviewCount)
      if (isNaN(reviewCount) || reviewCount < 0) {
        setError('Le nombre d\'avis doit être un nombre positif')
        return
      }
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.stores.update(storeId, {
        trustBadges: badges.length > 0 ? badges : null,
        trustpilotEnabled: trustpilot.enabled,
        trustpilotRating: trustpilot.rating ? parseFloat(trustpilot.rating) : null,
        trustpilotReviewCount: trustpilot.reviewCount ? parseInt(trustpilot.reviewCount) : null,
        trustpilotUrl: trustpilot.url || null,
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-3xl font-bold tracking-tight">Trust Badges</h1>
        <p className="text-gray-500">
          Ajoutez des badges de confiance affichés sous le récapitulatif de commande
        </p>
      </div>

      {/* Trustpilot Widget Config */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#00b67a] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white fill-white" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Widget Trustpilot</h3>
              <p className="text-sm text-gray-500">Affiché sous le bouton Payer</p>
            </div>
          </div>
          <Switch
            checked={trustpilot.enabled}
            onCheckedChange={(checked) => setTrustpilot({ ...trustpilot, enabled: checked })}
          />
        </div>

        {trustpilot.enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Note (sur 5) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={trustpilot.rating}
                  onChange={(e) => setTrustpilot({ ...trustpilot, rating: e.target.value })}
                  placeholder="4.7"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre d&apos;avis <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={trustpilot.reviewCount}
                  onChange={(e) => setTrustpilot({ ...trustpilot, reviewCount: e.target.value })}
                  placeholder="3167"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL Trustpilot (optionnel)</Label>
              <Input
                type="url"
                value={trustpilot.url}
                onChange={(e) => setTrustpilot({ ...trustpilot, url: e.target.value })}
                placeholder="https://www.trustpilot.com/review/example.com"
              />
              <p className="text-xs text-gray-500">Lien vers votre page Trustpilot (le nombre d&apos;avis sera cliquable)</p>
            </div>

            {/* Preview */}
            {trustpilot.rating && trustpilot.reviewCount && (
              <div className="p-4 border rounded-lg bg-white">
                <h4 className="font-medium text-sm mb-4 text-gray-600">Aperçu :</h4>
                <div className="p-4 border border-[#00b67a]/30 rounded-lg bg-[#f7faf9]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">Excellent</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://s6.imgcdn.dev/Y0VSGH.webp"
                        alt="Trustpilot stars"
                        className="h-6"
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      Noté {trustpilot.rating} / 5 basé sur{' '}
                      <span className="underline">{parseInt(trustpilot.reviewCount).toLocaleString('fr-FR')} avis</span>
                      {' '}sur{' '}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://s6.imgcdn.dev/Y0VGQi.webp"
                        alt="Trustpilot"
                        className="h-5 inline-block align-middle"
                      />
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Badges de confiance</h3>
            <p className="text-sm text-gray-500">Icône + Titre + Description</p>
          </div>
        </div>

        {/* Liste des badges */}
        <div className="space-y-4">
          {badges.map((badge, index) => (
            <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <GripVertical className="w-4 h-4" />
                  Badge {index + 1}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBadge(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Titre <span className="text-red-500">*</span></Label>
                <Input
                  value={badge.title}
                  onChange={(e) => updateBadge(index, 'title', e.target.value)}
                  placeholder="Service Client"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={badge.subtitle}
                  onChange={(e) => updateBadge(index, 'subtitle', e.target.value)}
                  placeholder="Nous répondons à vos questions du lundi au vendredi"
                />
              </div>

              {/* Icon selection: emoji or image URL */}
              <div className="space-y-3 p-3 bg-white rounded border">
                <Label className="text-sm font-medium">Icône du badge</Label>

                {/* Image URL input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    <Label className="text-xs text-gray-500">URL de l&apos;image (prioritaire si remplie)</Label>
                  </div>
                  <Input
                    value={badge.imageUrl || ''}
                    onChange={(e) => updateBadge(index, 'imageUrl', e.target.value)}
                    placeholder="https://example.com/icon.png"
                    className="text-sm"
                  />
                  {badge.imageUrl && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={badge.imageUrl}
                        alt="Preview"
                        className="w-8 h-8 object-contain border rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <span className="text-xs text-green-600">Image chargée</span>
                    </div>
                  )}
                </div>

                {/* Emoji fallback */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Ou choisir un emoji (utilisé si pas d&apos;image)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={badge.icon}
                      onChange={(e) => updateBadge(index, 'icon', e.target.value)}
                      placeholder="✅"
                      className="text-center text-xl w-16"
                      maxLength={4}
                    />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => updateBadge(index, 'icon', emoji)}
                          className={`w-8 h-8 rounded hover:bg-gray-200 transition-colors ${badge.icon === emoji && !badge.imageUrl ? 'bg-gray-200 ring-2 ring-gray-400' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {badges.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun badge configuré</p>
              <p className="text-sm">Cliquez sur &quot;Ajouter un badge&quot; pour commencer</p>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={addBadge}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un badge
        </Button>

        {/* Preview */}
        {badges.length > 0 && (
          <div className="p-4 border rounded-lg bg-white">
            <h4 className="font-medium text-sm mb-4 text-gray-600">Aperçu sur le checkout :</h4>
            <div className="space-y-4 border-t pt-4">
              {badges.map((badge, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    {badge.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={badge.imageUrl}
                        alt={badge.title || 'Badge'}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <span className="text-2xl">{badge.icon}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{badge.title || 'Titre du badge'}</p>
                    <p className="text-sm text-gray-500">{badge.subtitle || 'Description du badge'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>Badges sauvegardés !</span>
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
