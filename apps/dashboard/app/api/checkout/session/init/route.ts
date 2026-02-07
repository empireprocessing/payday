import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';

export async function POST(request: NextRequest) {
  try {
    // Récupérer le body de la requête du plugin WordPress
    const body = await request.json();

    console.log('📥 Bridge: Checkout session init request received');
    console.log('   - domain:', body.domain);
    console.log('   - cartToken:', body.cartToken);
    console.log('   - lineItems:', body.lineItems?.length, 'items');

    // Appeler l'API backend interne
    const response = await fetch(`${API_BASE_URL}/checkout/session/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Bridge: API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to initialize checkout' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Bridge: Checkout session initialized:', data.checkoutUrl);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Bridge: Error in checkout session init:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
