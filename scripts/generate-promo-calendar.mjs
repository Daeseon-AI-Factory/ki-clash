#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "marketing", "generated");

const campaigns = [
  {
    slug: "tiktok-pvp-01",
    channel: "TikTok",
    link: "https://jjan.daeseon.ai/go/tiktok-pvp-01",
  },
  {
    slug: "reels-pvp-01",
    channel: "Instagram Reels",
    link: "https://jjan.daeseon.ai/go/reels-pvp-01",
  },
  {
    slug: "shorts-pvp-01",
    channel: "YouTube Shorts",
    link: "https://jjan.daeseon.ai/go/shorts-pvp-01",
  },
  {
    slug: "x-founder-01",
    channel: "X",
    link: "https://jjan.daeseon.ai/go/x-founder-01",
  },
  {
    slug: "threads-founder-01",
    channel: "Threads",
    link: "https://jjan.daeseon.ai/go/threads-founder-01",
  },
  {
    slug: "reddit-playmygame-01",
    channel: "Reddit",
    link: "https://jjan.daeseon.ai/go/reddit-playmygame-01",
  },
  {
    slug: "discord-indie-01",
    channel: "Discord",
    link: "https://jjan.daeseon.ai/go/discord-indie-01",
  },
  {
    slug: "korea-community-01",
    channel: "Korean community",
    link: "https://jjan.daeseon.ai/go/korea-community-01",
  },
];

const hooks = [
  "설치 없이 친구랑 바로 붙는 기싸움 PvP",
  "10초 안에 성격 나오는 게임",
  "링크 하나 보내면 바로 대전 시작",
  "충전할지 때릴지 읽히면 바로 짐",
  "친구한테 보내고 한 판만 해봐",
  "No install. Open a room, send the link, duel.",
  "A tiny browser PvP mind game. One greedy charge can lose the match.",
  "I built a 1v1 ki duel you can play from one link.",
];

const clipPrompts = [
  "Create room -> copy link -> both ready -> first strike lands",
  "Player overcharges -> opponent punishes -> loss screen",
  "Two friends join from link -> instant best-of-3 duel",
  "Character select -> ready check -> sudden comeback",
  "Fast loss reaction -> rematch button -> new character",
  "Korean ki-battle visual focus -> PvP room CTA",
];

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=");
    if (key.startsWith("--")) args.set(key.slice(2), value ?? "true");
  }
  return args;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function captionFor({ hook, channel, link }) {
  if (channel === "Reddit") {
    return [
      "I built a browser-first 1v1 mind-game duel.",
      "",
      "No install. Create a PvP room, send the link, and play a short best-of-3 match.",
      "I am testing whether the invite flow is clear enough for real players.",
      "",
      link,
    ].join("\n");
  }

  if (channel === "Korean community") {
    return [
      "웹에서 바로 되는 1v1 심리전 게임 테스트 중입니다.",
      "",
      "설치 없이 링크로 PvP 방 만들고 친구랑 바로 붙는 구조예요.",
      "한 판 해보고 어디서 이탈하는지 피드백 부탁드립니다.",
      "",
      link,
    ].join("\n");
  }

  return `${hook}\n\n${link}\n\n#JJAN #KiClash #BrowserGame #PvP`;
}

function buildRows({ startDate, days, postsPerDay }) {
  const rows = [];
  let index = 0;

  for (let day = 0; day < days; day += 1) {
    for (let slot = 0; slot < postsPerDay; slot += 1) {
      const campaign = campaigns[index % campaigns.length];
      const hook = hooks[index % hooks.length];
      const clip = clipPrompts[index % clipPrompts.length];
      const date = addDays(startDate, day);
      const hour = [10, 13, 18, 21][slot % 4];
      const time = `${String(hour).padStart(2, "0")}:00`;

      rows.push({
        date: formatDate(date),
        time,
        channel: campaign.channel,
        slug: campaign.slug,
        hook,
        clip,
        link: campaign.link,
        caption: captionFor({ hook, channel: campaign.channel, link: campaign.link }),
        status: "draft",
      });
      index += 1;
    }
  }

  return rows;
}

function writeCsv(rows) {
  const headers = [
    "date",
    "time",
    "channel",
    "slug",
    "hook",
    "clip",
    "link",
    "caption",
    "status",
  ];

  const body = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  writeFileSync(join(outputDir, "promo-calendar.csv"), `${body}\n`);
}

function writeMarkdown(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const dayRows = grouped.get(row.date) ?? [];
    dayRows.push(row);
    grouped.set(row.date, dayRows);
  }
  const sections = [
    "# JJAN! Auto Promo Calendar",
    "",
    "Generated launch posting queue. Use the CSV for schedulers and this file for quick manual posting.",
    "",
  ];

  for (const [date, dayRows] of grouped.entries()) {
    sections.push(`## ${date}`, "");
    for (const row of dayRows) {
      sections.push(`### ${row.time} - ${row.channel} - ${row.slug}`);
      sections.push("");
      sections.push(`Clip: ${row.clip}`);
      sections.push("");
      sections.push("```text");
      sections.push(row.caption);
      sections.push("```");
      sections.push("");
    }
  }

  writeFileSync(join(outputDir, "promo-calendar.md"), `${sections.join("\n")}\n`);
}

const args = parseArgs();
const start = args.get("start") ?? new Date().toISOString().slice(0, 10);
const days = Number(args.get("days") ?? 7);
const postsPerDay = Number(args.get("posts-per-day") ?? 4);
const startDate = new Date(`${start}T00:00:00Z`);

if (Number.isNaN(startDate.getTime())) {
  throw new Error(`Invalid --start date: ${start}`);
}

mkdirSync(outputDir, { recursive: true });
const rows = buildRows({ startDate, days, postsPerDay });
writeCsv(rows);
writeMarkdown(rows);

console.log(`Wrote ${rows.length} promo slots to marketing/generated/`);
