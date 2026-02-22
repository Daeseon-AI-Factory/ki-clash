"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  /** AdSense ad slot ID */
  adSlot: string;
  /** Ad format (default: auto) */
  adFormat?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Google AdSense banner ad component.
 *
 * Renders a responsive banner ad. Only initializes once per mount
 * to avoid duplicate ad requests. Falls back to a placeholder in
 * development (no ad client configured).
 */
export default function AdBanner({
  adSlot,
  adFormat = "auto",
  className = "",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      // Push ad only if adsbygoogle script is loaded
      const adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
      if (adsbygoogle) {
        adsbygoogle.push({});
      }
    } catch {
      // AdSense not loaded (dev mode or ad blocker) — fail silently
    }
  }, []);

  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  // Development placeholder when no ad client is configured
  if (!adClient) {
    return (
      <div
        className={`bg-gray-800/50 border border-dashed border-gray-700
                    rounded-lg flex items-center justify-center text-xs
                    text-gray-600 h-16 ${className}`}
      >
        Ad Space
      </div>
    );
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
    />
  );
}
