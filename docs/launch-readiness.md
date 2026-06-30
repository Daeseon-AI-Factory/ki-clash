# JJAN Launch Readiness

This is the operating checklist for the first paid web beta. Use it in order.

## 1. Deployable Surface

- Web domain points to the Next app.
- API domain points to FastAPI/Caddy.
- `NEXT_PUBLIC_SITE_URL` is set to the public web URL.
- `NEXT_PUBLIC_API_URL` is set to the public API URL.
- `/api/health` on the web app returns `{ "ok": true }`.
- `/health` on the backend returns healthy.
- PvP WebSocket route works from a mobile browser on cellular data.

## 2. Launch Analytics

The web app now emits first-party launch events to:

```text
POST /api/analytics/events
```

The route logs one line per event:

```text
jjan_analytics_event { ...json... }
```

Minimum events to watch during the first 50-user test:

| Event | Meaning |
|---|---|
| `landing_view` | Someone reached the official page |
| `play_start` | A match actually started |
| `match_finish` | A match completed |
| `pvp_room_created` | A player created a shareable room |
| `invite_copied` | A player copied/shared a promo or room link |
| `return_next_day` | A player came back on a later date |
| `founder_pass_checkout_started` | A user clicked into payment intent |
| `founder_pass_checkout_success` | Checkout redirected back after purchase |

Do not buy ads until `play_start / landing_view` and `match_finish / play_start`
are visible in logs.

## 3. Founder Pass

The shop markets a Founder Pass through Lemon Squeezy hosted checkout. The
current fulfillment entitlement is `ad_free`; cosmetic entitlements can be
added to the same purchase record once profile cosmetics ship. Legacy Stripe
ad-free checkout remains in the backend but the shop calls the Lemon Squeezy
Founder Pass endpoint.

Before taking real money:

- Create a Lemon Squeezy product named `JJAN Founder Pass`.
- Set the one-time price, recommended launch test price: `$4.99`.
- Set `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, and
  `LEMON_SQUEEZY_FOUNDER_PASS_VARIANT_ID`.
- Set `LEMON_SQUEEZY_WEBHOOK_SECRET`.
- Start with `LEMON_SQUEEZY_TEST_MODE=true`; switch to `false` only after a
  successful test-mode purchase.
- Configure Lemon Squeezy webhook:

```text
POST https://<api-domain>/api/v1/purchases/webhook/lemonsqueezy
```

- Run one test-mode purchase and verify `ad_free=true` for the buyer.

## 4. First Promotion Batch

Ship only after the above is live:

- 5 short clips under 10 seconds.
- 1 character roster image.
- 1 direct PvP invite link.
- 1 Discord/Kakao feedback channel.
- 1 feedback form.

The first goal is not revenue volume. The first goal is proof that players:

- start a match,
- finish a match,
- share a PvP room,
- return the next day,
- and at least click the Founder Pass checkout.

## 5. Go/No-Go Numbers

For the first 50 testers:

- `match_finish / play_start` should be at least `40%`.
- `pvp_room_created / play_start` should be at least `10%`.
- `invite_copied / pvp_room_created` should be at least `50%`.
- At least 3 people should return the next day.
- At least 1 person should click Founder Pass checkout.

If these fail, fix onboarding/game feel before adding ads or more monetization.
