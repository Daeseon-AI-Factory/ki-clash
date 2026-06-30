#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

const campaigns = read("web/src/lib/promo-campaigns.ts");
const promoPage = read("web/src/app/promo/page.tsx");
const goPage = read("web/src/app/go/[slug]/page.tsx");
const analytics = read("web/src/lib/analytics.ts");
const home = read("web/src/app/page.tsx");
const invite = read("web/src/app/invite/page.tsx");

for (const slug of [
  "tiktok-pvp-01",
  "reels-pvp-01",
  "shorts-pvp-01",
  "reddit-playmygame-01",
  "discord-indie-01",
  "korea-community-01",
  "friend-share",
]) {
  requireIncludes(campaigns, slug, "promo campaigns");
}

for (const field of [
  "promo",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
]) {
  requireIncludes(analytics, field, "analytics campaign fields");
}

for (const eventName of [
  "promo_link_opened",
  "promo_cta_clicked",
  "promo_link_copied",
]) {
  requireIncludes(analytics, eventName, `analytics event ${eventName}`);
}

requireIncludes(goPage, "router.replace", "promo redirect");
requireIncludes(goPage, "buildCampaignTarget", "promo redirect target");
requireIncludes(promoPage, "Trackable launch links", "promo kit page");
requireIncludes(promoPage, "Clip shot list", "promo kit page");
requireIncludes(home, "friend-share", "home share link");
requireIncludes(invite, "friend-share", "invite share link");

if (failures.length > 0) {
  console.error("Launch marketing check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Launch marketing check passed.");
