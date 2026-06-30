"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  PROMO_CAMPAIGN_BY_SLUG,
  buildCampaignTarget,
  campaignSearchParams,
} from "@/lib/promo-campaigns";

export default function PromoRedirectPage() {
  const router = useRouter();
  const params = useParams<{ slug?: string | string[] }>();
  const incomingParams = useSearchParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const campaign = slug ? PROMO_CAMPAIGN_BY_SLUG[slug] : undefined;

  const target = useMemo(() => {
    if (!campaign) return "/";

    const url = new URL(
      buildCampaignTarget(
        campaign,
        typeof window === "undefined" ? "https://jjan.daeseon.ai" : window.location.origin,
      ),
    );

    incomingParams.forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });

    return `${url.pathname}${url.search}`;
  }, [campaign, incomingParams]);

  useEffect(() => {
    if (!campaign) return;

    const search = campaignSearchParams(campaign);
    incomingParams.forEach((value, key) => {
      if (!search.has(key)) search.set(key, value);
    });

    trackEvent("promo_link_opened", {
      promo: campaign.slug,
      target_path: campaign.targetPath,
      angle: campaign.angle,
      utm_source: search.get("utm_source"),
      utm_medium: search.get("utm_medium"),
      utm_campaign: search.get("utm_campaign"),
      utm_content: search.get("utm_content"),
    });

    const timer = window.setTimeout(() => {
      router.replace(target);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [campaign, incomingParams, router, target]);

  if (!campaign) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b14] px-5 text-white">
        <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.045] p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-200">
            Link not found
          </p>
          <h1 className="mt-3 text-3xl font-black">This promo link is not active.</h1>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-yellow-300 px-5 py-3 text-sm font-black text-gray-950"
          >
            Open JJAN!
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b14] px-5 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.045] p-6">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-200">
          Opening JJAN!
        </p>
        <h1 className="mt-3 text-3xl font-black">{campaign.label}</h1>
        <p className="mt-3 text-sm leading-6 text-white/62">
          Loading the playable page with campaign tracking attached.
        </p>
        <Link
          href={target}
          className="mt-6 inline-flex rounded-lg bg-yellow-300 px-5 py-3 text-sm font-black text-gray-950"
          onClick={() =>
            trackEvent("promo_cta_clicked", {
              promo: campaign.slug,
              surface: "promo_redirect",
            })
          }
        >
          Continue now
        </Link>
      </section>
    </main>
  );
}
