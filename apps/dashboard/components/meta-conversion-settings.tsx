"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2, Check, Eye, EyeOff } from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface MetaConversionSettingsProps {
  storeId: string
}


export function MetaConversionSettings({ storeId }: MetaConversionSettingsProps) {
  const [pixelId, setPixelId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [newCustomersOnly, setNewCustomersOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchingLoading, setFetchingLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showPixelId, setShowPixelId] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function loadSettings() {
    try {
      setFetchingLoading(true)
      const data = await apiClient.meta.getSettings(storeId)

      if (data.metaPixelId) {
        setPixelId(data.metaPixelId)
        setEnabled(true)
      }
      if (data.metaAccessToken) {
        setAccessToken(data.metaAccessToken)
      }
      setNewCustomersOnly(data.metaNewCustomersOnly || false)
    } catch (err) {
      console.error('Error loading Meta settings:', err)
    } finally {
      setFetchingLoading(false)
    }
  }

  async function handleSave() {
    // Validation : au minimum le Pixel ID doit être rempli si enabled
    if (enabled && !pixelId) {
      setError('Le Pixel ID est requis')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await apiClient.meta.updateSettings(storeId, {
        metaPixelId: enabled ? pixelId : null,
        metaAccessToken: enabled ? accessToken : null,
        metaNewCustomersOnly: enabled ? newCustomersOnly : false,
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
        <h1 className="text-3xl font-bold tracking-tight">Configure Meta Conversion API</h1>
        <p className="text-gray-500">
          Meta S2S (Server to Server) tracking
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 36 36" fill="white" className="w-7 h-7">
                <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87Z" />
                <path fill="#1877F2" d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.5h-4.867v12.37a18.183 18.183 0 0 1-6.53-.399Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Meta Conversion API</h3>
              <p className="text-sm text-gray-500">Track purchases server-side</p>
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
                  placeholder="123456789012345"
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
              <p className="text-xs text-gray-500">Requis pour le tracking Meta Pixel</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token <span className="text-gray-400 text-sm">(optionnel)</span></Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showAccessToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxxx..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Requis uniquement pour l&apos;API Conversion (tracking serveur)</p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="newCustomersOnly" className="text-base font-medium cursor-pointer">
                  Publish the &quot;Purchase&quot; event only for new customers
                </Label>
                <p className="text-sm text-gray-500">
                  Only send events when the customer makes their first purchase
                </p>
              </div>
              <Switch
                id="newCustomersOnly"
                checked={newCustomersOnly}
                onCheckedChange={setNewCustomersOnly}
                className="data-[state=checked]:bg-green-600"
              />
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
            className="bg-blue-600 hover:bg-blue-700"
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

      <Card className="p-6 bg-blue-950/30 border-blue-800">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-400">
          <AlertCircle className="h-5 w-5" />
          How to get your Meta credentials
        </h3>
        <ol className="space-y-2 text-sm text-gray-300 ml-7 list-decimal">
          <li>Go to <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Facebook Business Manager</a></li>
          <li>Navigate to <strong>Events Manager</strong> and select your Pixel</li>
          <li>Go to <strong>Settings</strong> → <strong>Conversions API</strong></li>
          <li>Generate an <strong>Access Token</strong> and copy it</li>
          <li>Your <strong>Pixel ID</strong> is shown at the top of the page</li>
        </ol>
      </Card>
    </div>
  )
}
