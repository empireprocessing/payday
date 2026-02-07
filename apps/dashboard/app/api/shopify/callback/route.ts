import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  if (!code || !shop || !state) {
    return NextResponse.redirect(
      `${DASHBOARD_URL}/boutiques?shopify_error=missing_params`
    );
  }

  try {
    // Forward to API to exchange code for access token
    const response = await fetch(`${API_BASE_URL}/shopify/oauth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, shop, state, hmac }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Shopify OAuth callback error:', error);
      return NextResponse.redirect(
        `${DASHBOARD_URL}/boutiques?shopify_error=token_exchange_failed`
      );
    }

    const data = await response.json();

    if (data.success) {
      return NextResponse.redirect(
        `${DASHBOARD_URL}/boutiques?shopify_connected=true&store_id=${data.store?.id || ''}`
      );
    }

    return NextResponse.redirect(
      `${DASHBOARD_URL}/boutiques?shopify_error=unknown`
    );
  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    return NextResponse.redirect(
      `${DASHBOARD_URL}/boutiques?shopify_error=internal`
    );
  }
}
