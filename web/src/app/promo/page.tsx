"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  PROMO_CAMPAIGNS,
  buildCampaignTarget,
  buildPromoUrl,
  type PromoCampaign,
} from "@/lib/promo-campaigns";

const POSTS = [
  {
    channel: "Short-form video",
    title: "Friend duel",
    copy:
      "설치 없이 친구랑 바로 붙는 기싸움 PvP 만들었습니다. 링크 누르면 방 만들고 바로 대전됩니다.",
  },
  {
    channel: "Community",
    title: "Feedback ask",
    copy:
      "웹에서 바로 되는 1v1 심리전 게임 테스트 중입니다. PvP 방 만들고 한 판만 해보고 어디서 이탈하는지 피드백 부탁드립니다.",
  },
  {
    channel: "Founder post",
    title: "Build-in-public",
    copy:
      "JJAN! Ki Clash is live as a browser-first 1v1 ki reveal duel. No install, just open a PvP room and send the link.",
  },
  {
    channel: "Creator DM",
    title: "Demo request",
    copy:
      "짧은 PvP 웹게임 하나 만들었습니다. 30초 안에 한 판 끝나는 친구 대전용이라 쇼츠 소재로 맞을 것 같아 데모 링크 보냅니다.",
  },
];

const SHOT_LIST = [
  "방 생성 버튼 누르는 1초",
  "친구에게 코드/링크 보내는 장면",
  "둘 다 Ready 되는 장면",
  "충전하다가 한 방 맞는 장면",
  "승리/패배 결과 화면",
  "다른 캐릭터로 재도전하는 장면",
];

function subscribeOrigin() {
  return () => undefined;
}

function getClientOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return "https://jjan.daeseon.ai";
}

export default function PromoKitPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = useSyncExternalStore(
    subscribeOrigin,
    getClientOrigin,
    getServerOrigin,
  );

  const links = useMemo(
    () =>
      PROMO_CAMPAIGNS.map((campaign) => ({
        campaign,
        shortUrl: buildPromoUrl(campaign, origin),
        targetUrl: buildCampaignTarget(campaign, origin),
      })),
    [origin],
  );

  const copyText = async (
    text: string,
    label: string,
    campaign?: PromoCampaign,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      trackEvent("promo_link_copied", {
        surface: "promo_kit",
        label,
        promo: campaign?.slug,
      });
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b14] text-white">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-white/52 hover:text-white">
              Official page
            </Link>
            <h1 className="mt-4 text-3xl font-black sm:text-5xl">
              JJAN! promo kit
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Use these links for launch posts. Every link redirects through
              `/go` first, then lands on the playable page with campaign
              parameters attached.
            </p>
          </div>
          <Link
            href="/pvp"
            className="rounded-lg bg-yellow-300 px-5 py-3 text-center text-sm font-black text-gray-950"
          >
            Test PvP flow
          </Link>
        </header>

        <section className="grid gap-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.045]">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yellow-200">
                Trackable launch links
              </h2>
            </div>
            <div className="divide-y divide-white/10">
              {links.map(({ campaign, shortUrl, targetUrl }) => (
                <div key={campaign.slug} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black">{campaign.label}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-bold text-white/48">
                        {campaign.medium}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/58">{campaign.angle}</p>
                    <p className="mt-3 break-all font-mono text-xs text-cyan-200">
                      {shortUrl}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-white/36">
                      {targetUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => copyText(shortUrl, campaign.slug, campaign)}
                    className="h-10 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-black text-cyan-100 hover:bg-cyan-300/15"
                  >
                    {copied === campaign.slug ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid content-start gap-4">
            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-rose-200">
                First 48h target
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Posts" value="20" />
                <Metric label="Clicks" value="300" />
                <Metric label="PvP rooms" value="50" />
                <Metric label="Finished matches" value="25" />
              </dl>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                Clip shot list
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-white/64">
                {SHOT_LIST.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section className="grid gap-4 pb-10 md:grid-cols-2">
          {POSTS.map((post) => (
            <article key={post.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                {post.channel}
              </p>
              <h3 className="mt-2 text-lg font-black">{post.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/68">
                {post.copy}
              </p>
              <button
                onClick={() => copyText(post.copy, post.title)}
                className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
              >
                {copied === post.title ? "Copied" : "Copy copy"}
              </button>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-black">{value}</dd>
    </div>
  );
}
