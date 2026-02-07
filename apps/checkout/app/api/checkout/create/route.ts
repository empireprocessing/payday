// app/api/checkout/create/route.ts
import { NextRequest, NextResponse } from "next/server";

function corsAll() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*"); // universel
  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

async function safeJson(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return {};
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Preflight CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAll() });
}

export async function POST(request: NextRequest) {
  console.error('🔍 Request:', request)
  const headers = corsAll();

  try {
    // body facultatif
    const body = await safeJson(request);
    const cartId = body?.cartId ?? null;

    if (!cartId) {
      console.error('❌ cartId is required', { body, headers: Object.fromEntries(request.headers.entries()) })
      return NextResponse.json(
        { success: false, error: "cartId est requis" },
        { status: 400, headers }
      );
    }

    // Le payDomain est l'host sur lequel cette API est hébergée
    const payDomain = request.headers.get("host") || request.nextUrl.hostname;
    
    // Récupérer l'origin de la requête pour validation
    const origin = request.headers.get("origin");
    
    console.error('🔍 Debug:', { cartId, payDomain, origin, host: request.headers.get("host") })

    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:5000";
    console.error('🔗 API URL:', apiUrl);

    const resp = await fetch(`${apiUrl}/checkout/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Si ton API interne est dans le même réseau et n'a pas besoin de cookies
      // pas de credentials ici non plus :
      body: JSON.stringify({ cartId, payDomain, origin }),
      // Timeout augmenté pour laisser le temps au backend de récupérer les données Shopify
      signal: AbortSignal.timeout?.(12000), // 12 seconds (backend has 10s + margin)
    });

    // Tente de parser le JSON même si non-OK (pour propager l'erreur renvoyée)
    let result: unknown = null;
    try {
      result = await resp.json();
    } catch {
      result = null;
    }

    if (!resp.ok) {
      console.error('❌ API Error:', { status: resp.status, result });
      const errorMessage = (result as { error?: string })?.error || "Erreur interne";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: resp.status, headers }
      );
    }

    // On s'attend à { success: true, checkoutId: "..." }
    console.error('✅ Checkout créé:', result)
    return NextResponse.json(result, { headers });
  } catch (error: unknown) {
    console.error("❌ Erreur lors de la création du checkout:", error);
    const errorMessage = (error as { message?: string })?.message || "Erreur interne du serveur";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers }
    );
  }
}