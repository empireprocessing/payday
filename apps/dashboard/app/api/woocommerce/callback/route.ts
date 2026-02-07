import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:4000';

async function handleCallback(request: NextRequest) {
  // WooCommerce envoie les données en POST body pour les callbacks
  let userId, consumerKey, consumerSecret, keyPermissions, success;

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      console.log('📥 WooCommerce OAuth callback received (POST body):', body);

      userId = body.user_id;
      consumerKey = body.consumer_key;
      consumerSecret = body.consumer_secret;
      keyPermissions = body.key_permissions;
      success = body.success;
    } catch (error) {
      // Si le body n'est pas JSON, essayer form data
      const formData = await request.formData();
      console.log('📥 WooCommerce OAuth callback received (Form data)');

      userId = formData.get('user_id');
      consumerKey = formData.get('consumer_key');
      consumerSecret = formData.get('consumer_secret');
      keyPermissions = formData.get('key_permissions');
      success = formData.get('success');
    }
  } else {
    // Fallback sur query params pour GET
    const searchParams = request.nextUrl.searchParams;
    userId = searchParams.get('user_id');
    consumerKey = searchParams.get('consumer_key');
    consumerSecret = searchParams.get('consumer_secret');
    keyPermissions = searchParams.get('key_permissions');
    success = searchParams.get('success');
  }

  console.log('📥 WooCommerce OAuth callback parsed:');
  console.log('   - userId:', userId);
  console.log('   - consumerKey:', consumerKey ? consumerKey.substring(0, 10) + '...' : 'null');
  console.log('   - keyPermissions:', keyPermissions);

  // Si WooCommerce appelle le callback avec consumer_key et consumer_secret, c'est un succès
  if (!userId || !consumerKey || !consumerSecret) {
    console.error('❌ Missing required parameters');
    return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Décoder le userId
    const decoded = JSON.parse(Buffer.from(userId, 'base64').toString());
    const { storeId, accountId } = decoded;

    console.log(`✅ OAuth success for store: ${storeId}`);

    // Appeler l'API interne pour stocker les credentials
    const response = await fetch(`${API_BASE_URL}/store/${storeId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Store not found');
    }

    const store = await response.json();

    // Mettre à jour le store avec les credentials
    const updateResponse = await fetch(`${API_BASE_URL}/store/${storeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: 'WOOCOMMERCE',
        platformConfig: {
          domain: store.domain,
          consumerKey: consumerKey,
          consumerSecret: consumerSecret,
          permissions: keyPermissions,
          connectedAt: new Date().toISOString(),
        },
      }),
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to update store');
    }

    console.log(`✅ WooCommerce credentials saved for store: ${storeId}`);

    // Retourner une réponse JSON de succès à WooCommerce
    // WooCommerce redirigera ensuite l'utilisateur vers le return_url
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error in OAuth callback:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log('🔍 Callback route hit via GET');
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  console.log('🔍 Callback route hit via POST');
  return handleCallback(request);
}
