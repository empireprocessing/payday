import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000'

/**
 * GET /api/stripe-connect/callback?code=ac_xxx&state=pspId
 * Reçoit le redirect OAuth de Stripe, échange le code via le backend,
 * puis redirige vers /psp avec le résultat.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // pspId
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Si Stripe renvoie une erreur (utilisateur a annulé ou refusé)
  if (error) {
    const message = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(new URL(`/psp?connect_error=${message}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/psp?connect_error=Paramètres manquants', request.url))
  }

  try {
    const response = await fetch(`${API_BASE_URL}/psp/stripe-connect/oauth-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      const message = encodeURIComponent(result.message || 'Erreur lors de la connexion')
      return NextResponse.redirect(new URL(`/psp?connect_error=${message}`, request.url))
    }

    const result = await response.json()
    return NextResponse.redirect(
      new URL(`/psp?connected=true&pspId=${state}&status=${result.status}`, request.url)
    )
  } catch (err) {
    const message = encodeURIComponent('Erreur de communication avec le serveur')
    return NextResponse.redirect(new URL(`/psp?connect_error=${message}`, request.url))
  }
}
