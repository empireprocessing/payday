"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import * as pixel from "../lib/fpixel";

interface FacebookPixelProps {
  pixelId?: string | null;
}

/**
 * Composant Facebook Pixel
 * Charge le SDK et track automatiquement les page views
 */
export default function FacebookPixel({ pixelId }: FacebookPixelProps) {
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  // Utiliser le pixelId fourni, sinon l'env, sinon null
  const activePixelId = pixelId || pixel.FB_PIXEL_ID;

  // Track les page views à chaque changement de route (y compris le chargement initial)
  useEffect(() => {
    if (!loaded || !activePixelId) return;

    pixel.pageview();
  }, [pathname, loaded, activePixelId]);

  // Ne rien rendre si pas de Pixel ID
  if (!activePixelId) {
    return null;
  }

  return (
    <>
      <Script
        id="fb-pixel"
        src="/scripts/pixel.js"
        strategy="afterInteractive"
        onLoad={() => {
          setLoaded(true);
          console.log("✅ Facebook Pixel loaded");
        }}
        data-pixel-id={activePixelId}
      />
      {/* noscript fallback pour les navigateurs sans JS */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${activePixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
