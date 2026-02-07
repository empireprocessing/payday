"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2, Check, Eye, EyeOff } from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface TiktokPixelSettingsProps {
  storeId: string
}

export function TiktokPixelSettings({ storeId }: TiktokPixelSettingsProps) {
  const [pixelId, setPixelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingLoading, setFetchingLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPixelId, setShowPixelId] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function loadSettings() {
    try {
      setFetchingLoading(true)
      const data = await apiClient.tiktok.getSettings(storeId)

      if (data.tiktokPixelId) {
        setPixelId(data.tiktokPixelId)
        setEnabled(true)
      }
    } catch (err) {
      console.error('Error loading TikTok settings:', err)
    } finally {
      setFetchingLoading(false)
    }
  }

  async function handleSave() {
    // Validation : au minimum le Pixel ID doit etre rempli si enabled
    if (enabled && !pixelId) {
      setError('Le Pixel ID est requis')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.tiktok.updateSettings(storeId, {
        tiktokPixelId: enabled ? pixelId : null,
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
        <h1 className="text-3xl font-bold tracking-tight">Configure TikTok Pixel</h1>
        <p className="text-gray-500">
          Tracking des conversions TikTok Ads
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 48 48" fill="white" className="w-7 h-7">
                <path d="M38.4 21.68V16c-2.66 0-4.69-.71-6-1.78a9.63 9.63 0 01-3.09-4.52h-4.99v22.28c0 .09.01.17.01.26a5.56 5.56 0 01-5.55 5.28c-3.07 0-5.56-2.5-5.56-5.57s2.49-5.57 5.56-5.57c.6 0 1.18.1 1.72.28v-5.1a10.5 10.5 0 00-1.72-.14c-5.83 0-10.55 4.73-10.55 10.57a10.52 10.52 0 0010.55 10.57 10.52 10.52 0 0010.55-10.57V21.12a14.62 14.62 0 009.07 3.13v-5.04c-.01 0-.01 0 0 0a9.58 9.58 0 01-4.99-2.47v4.94z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">TikTok Pixel</h3>
              <p className="text-sm text-gray-500">Track PageView, InitiateCheckout, CompletePayment</p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pixelId">Pixel ID <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="pixelId"
                  type={showPixelId ? "text" : "password"}
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="XXXXXXXXXXXXXXXXXX"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPixelId(!showPixelId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPixelId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Votre TikTok Pixel ID (format: suite de chiffres)</p>
            </div>

            <div className="p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium text-sm mb-2">Events tracked automatiquement :</h4>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• <strong>PageView</strong> - A chaque page visitee sur le checkout</li>
                <li>• <strong>InitiateCheckout</strong> - Quand le client arrive sur le checkout</li>
                <li>• <strong>CompletePayment</strong> - Quand le paiement est valide</li>
              </ul>
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
            <span>Settings saved successfully!</span>
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
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-gray-950/30 border-gray-800">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-400">
          <AlertCircle className="h-5 w-5" />
          How to get your TikTok Pixel ID
        </h3>
        <ol className="space-y-2 text-sm text-gray-300 ml-7 list-decimal">
          <li>Go to <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">TikTok Ads Manager</a></li>
          <li>Navigate to <strong>Assets</strong> &rarr; <strong>Events</strong></li>
          <li>Select <strong>Web Events</strong> and click <strong>Manage</strong></li>
          <li>Create a new Pixel or select an existing one</li>
          <li>Copy your <strong>Pixel ID</strong> (a long number like 1234567890123456789)</li>
        </ol>
      </Card>
    </div>
  )
}
