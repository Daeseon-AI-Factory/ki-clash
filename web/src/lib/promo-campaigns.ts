export type PromoCampaign = {
  slug: string;
  label: string;
  targetPath: "/play" | "/pvp" | "/";
  source: string;
  medium: "organic" | "community" | "paid" | "direct" | "creator";
  campaign: string;
  content: string;
  angle: string;
};

export const PROMO_CAMPAIGNS = [
  {
    slug: "tiktok-pvp-01",
    label: "TikTok PvP clip 01",
    targetPath: "/pvp",
    source: "tiktok",
    medium: "organic",
    campaign: "launch_week1",
    content: "pvp_clip_01",
    angle: "10-second friend duel",
  },
  {
    slug: "reels-pvp-01",
    label: "Instagram Reels PvP clip 01",
    targetPath: "/pvp",
    source: "instagram",
    medium: "organic",
    campaign: "launch_week1",
    content: "pvp_clip_01",
    angle: "send a room link",
  },
  {
    slug: "shorts-pvp-01",
    label: "YouTube Shorts PvP clip 01",
    targetPath: "/pvp",
    source: "youtube",
    medium: "organic",
    campaign: "launch_week1",
    content: "pvp_clip_01",
    angle: "instant browser PvP",
  },
  {
    slug: "x-founder-01",
    label: "X founder post",
    targetPath: "/",
    source: "x",
    medium: "organic",
    campaign: "launch_week1",
    content: "founder_post_01",
    angle: "public build launch",
  },
  {
    slug: "threads-founder-01",
    label: "Threads founder post",
    targetPath: "/",
    source: "threads",
    medium: "organic",
    campaign: "launch_week1",
    content: "founder_post_01",
    angle: "public build launch",
  },
  {
    slug: "reddit-playmygame-01",
    label: "Reddit playmygame post",
    targetPath: "/pvp",
    source: "reddit",
    medium: "community",
    campaign: "launch_week1",
    content: "playmygame_post_01",
    angle: "feedback request",
  },
  {
    slug: "discord-indie-01",
    label: "Discord indie channel",
    targetPath: "/pvp",
    source: "discord",
    medium: "community",
    campaign: "launch_week1",
    content: "indie_channel_01",
    angle: "find a PvP tester",
  },
  {
    slug: "korea-community-01",
    label: "Korean community post",
    targetPath: "/pvp",
    source: "korea_community",
    medium: "community",
    campaign: "launch_week1",
    content: "community_post_01",
    angle: "Korean ki-battle browser game",
  },
  {
    slug: "friend-share",
    label: "General friend share",
    targetPath: "/pvp",
    source: "friend",
    medium: "direct",
    campaign: "launch_week1",
    content: "friend_share",
    angle: "challenge a friend",
  },
  {
    slug: "creator-demo",
    label: "Creator demo link",
    targetPath: "/pvp",
    source: "creator",
    medium: "creator",
    campaign: "launch_week1",
    content: "creator_demo",
    angle: "record a live duel",
  },
] as const satisfies readonly PromoCampaign[];

export const PROMO_CAMPAIGN_BY_SLUG = Object.fromEntries(
  PROMO_CAMPAIGNS.map((campaign) => [campaign.slug, campaign]),
) as Record<string, PromoCampaign>;

export function campaignSearchParams(campaign: PromoCampaign): URLSearchParams {
  return new URLSearchParams({
    promo: campaign.slug,
    ref: campaign.source,
    utm_source: campaign.source,
    utm_medium: campaign.medium,
    utm_campaign: campaign.campaign,
    utm_content: campaign.content,
  });
}

export function buildPromoUrl(
  campaign: PromoCampaign,
  origin = "https://jjan.daeseon.ai",
): string {
  const url = new URL(`/go/${campaign.slug}`, origin);
  return url.toString();
}

export function buildCampaignTarget(
  campaign: PromoCampaign,
  origin = "https://jjan.daeseon.ai",
): string {
  const url = new URL(campaign.targetPath, origin);
  url.search = campaignSearchParams(campaign).toString();
  return url.toString();
}

export function readCampaignProperties(searchParams: URLSearchParams) {
  return {
    promo: searchParams.get("promo"),
    ref: searchParams.get("ref"),
    utm_source: searchParams.get("utm_source"),
    utm_medium: searchParams.get("utm_medium"),
    utm_campaign: searchParams.get("utm_campaign"),
    utm_content: searchParams.get("utm_content"),
  };
}
