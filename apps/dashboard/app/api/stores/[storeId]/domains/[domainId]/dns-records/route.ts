import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; domainId: string }> }
) {
  try {
    const { storeId, domainId } = await params;

    console.log(`[DNS Records] Fetching DNS records for store ${storeId}, domain ${domainId}`);

    // Appeler l'API backend
    const response = await fetch(`${API_BASE_URL}/stores/${storeId}/domains/${domainId}/dns-records`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DNS Records] API error:`, response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get DNS records' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[DNS Records] Successfully fetched DNS records`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[DNS Records] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
