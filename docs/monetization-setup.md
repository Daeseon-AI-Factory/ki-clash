# JJAN Monetization Setup

This is the production setup checklist for the current web-first monetization
path.

## Current State

- Web ad components are already mounted in play/PvP surfaces.
- Ads show placeholders until `NEXT_PUBLIC_ADSENSE_CLIENT` is configured.
- `useAdTiming` suppresses forced ads for players with `ad_free=true`.
- The shop sells `Founder Pass` through Lemon Squeezy hosted checkout.
- Lemon Squeezy webhook fulfillment currently grants the `ad_free`
  entitlement.
- Legacy Stripe ad-free checkout is still present in the backend, but the shop
  calls the Lemon Squeezy Founder Pass endpoint.

## AdSense

Set these in Vercel after the site is approved in AdSense:

```text
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-...
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=...
NEXT_PUBLIC_ADSENSE_INTERSTITIAL_SLOT=...
```

Do not expect real ads before AdSense approves the domain and returns real ad
IDs. Until then, the UI renders placeholder ad boxes.

## Lemon Squeezy

Create a product:

```text
Product: JJAN Founder Pass
Type: one-time purchase
Launch test price: $4.99
Fulfillment entitlement: ad_free
```

Add these to the Naver Cloud server `.env` used by `docker-compose.naver.yml`:

```text
LEMON_SQUEEZY_API_KEY=...
LEMON_SQUEEZY_STORE_ID=...
LEMON_SQUEEZY_FOUNDER_PASS_VARIANT_ID=...
LEMON_SQUEEZY_WEBHOOK_SECRET=...
LEMON_SQUEEZY_TEST_MODE=true
```

Switch `LEMON_SQUEEZY_TEST_MODE=false` only after a successful test checkout and
webhook fulfillment.

Configure Lemon Squeezy webhook:

```text
https://api.jjan.daeseon.ai/api/v1/purchases/webhook/lemonsqueezy
```

Use the same signing secret in Lemon Squeezy and
`LEMON_SQUEEZY_WEBHOOK_SECRET`. Subscribe at least to `order_created`.

## Verification

1. Deploy backend with the Lemon Squeezy env values.
2. Open `https://jjan.daeseon.ai/shop`.
3. Click `Get Founder Pass`.
4. Confirm Lemon Squeezy hosted checkout opens.
5. Complete a test purchase.
6. Confirm the player has `ad_free=true`.
7. Reload play/PvP and verify interstitial ads are suppressed for that player.

## Useful Endpoints

```text
GET  /api/v1/purchases/ad-free-status
POST /api/v1/purchases/checkout/founder-pass
POST /api/v1/purchases/webhook/lemonsqueezy
```

