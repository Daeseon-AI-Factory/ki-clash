"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackDailyReturn, trackEvent } from "@/lib/analytics";

export default function AnalyticsBootstrap() {
  return (
    <Suspense fallback={null}>
      <AnalyticsBootstrapInner />
    </Suspense>
  );
}

function AnalyticsBootstrapInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackDailyReturn();
  }, []);

  useEffect(() => {
    const search = searchParams.toString();
    trackEvent("page_view", {
      pathname,
      search: search || null,
    });

    if (pathname === "/") {
      trackEvent("landing_view", {
        ref: searchParams.get("ref"),
        promo: searchParams.get("promo"),
        utm_source: searchParams.get("utm_source"),
        utm_medium: searchParams.get("utm_medium"),
        utm_campaign: searchParams.get("utm_campaign"),
        utm_content: searchParams.get("utm_content"),
      });
    }
  }, [pathname, searchParams]);

  return null;
}
