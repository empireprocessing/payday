"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import * as ttqpixel from "../lib/ttqpixel";

interface TiktokPixelProps {
  pixelId?: string | null;
}

/**
 * Composant TikTok Pixel
 * Charge le SDK et track automatiquement les page views
 */
export default function TiktokPixel({ pixelId }: TiktokPixelProps) {
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  // Track les page views a chaque changement de route
  useEffect(() => {
    if (!loaded || !pixelId) return;

    ttqpixel.pageview();
  }, [pathname, loaded, pixelId]);

  // Ne rien rendre si pas de Pixel ID
  if (!pixelId) {
    return null;
  }

  return (
    <Script
      id="ttq-pixel"
      src="/scripts/tiktok-pixel.js"
      strategy="afterInteractive"
      onLoad={() => {
        setLoaded(true);
        console.log("✅ TikTok Pixel loaded");
      }}
      data-pixel-id={pixelId}
    />
  );
}
