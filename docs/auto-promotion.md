# JJAN! Auto Promotion Workflow

## Position

Do not build a spam bot. Automate the repeatable work:

- generate channel-specific links,
- generate captions and a posting calendar,
- queue posts in an approved scheduler or official API,
- measure which links create rooms and finished matches.

The game does not need App Store launch to run this test. Use the web links.

## What Can Be Automated Now

Run:

```bash
node scripts/generate-promo-calendar.mjs --start=2026-06-18 --days=7 --posts-per-day=4
```

Outputs:

```text
marketing/generated/promo-calendar.csv
marketing/generated/promo-calendar.md
```

Use the CSV in a scheduler, or copy from the Markdown file manually.

## Safe Automation Levels

| Level | What happens | Use now? |
| --- | --- | --- |
| 1 | Generate links, captions, calendar | Yes |
| 2 | Upload clips manually, paste generated captions | Yes |
| 3 | Use Buffer/Later/Hootsuite/Metricool style scheduler | Yes, if account connected |
| 4 | Direct API posting with OAuth tokens | Later |
| 5 | Bot replies, mass DM, repeated community posting | No |

## Platform Notes

### TikTok

TikTok has a Content Posting API, but real public posting requires a registered
developer app, Direct Post configuration, approved `video.publish` scope, and
creator authorization. TikTok also notes that unaudited clients are restricted
to private viewing mode until the API client passes audit.

Practical use now: generate captions and links; post or schedule manually.

### YouTube Shorts

YouTube Data API supports video upload through `videos.insert`. This still needs
Google OAuth, quota, and an authenticated channel.

Practical use now: upload Shorts manually or through an approved scheduler.

### X

X API supports creating posts through `POST /2/tweets` for an authenticated
user token. Access depends on the current X API tier and app permissions.

Practical use now: generated post text can be pasted or queued in a scheduler.

### Reddit

Reddit exposes `api/submit`, but subreddit rules matter more than the endpoint.
Automated posting into communities without context is likely to get removed or
ban the account.

Practical use now: use the generated Reddit post as a sincere feedback request.

## Daily Run

1. Record 2-3 gameplay clips.
2. Cut each into 4 hooks.
3. Run the calendar generator.
4. Upload/schedule 4 posts.
5. Check Vercel logs for `jjan_analytics_event`.
6. Kill hooks that get clicks but no `pvp_room_created`.

## Metrics To Review

```text
promo_link_opened
pvp_room_created
invite_copied
pvp_room_joined
pvp_match_started
match_finish
return_next_day
```

Ratios:

```text
pvp_room_created / promo_link_opened
pvp_match_started / pvp_room_created
match_finish / pvp_match_started
```

## API Posting Later

When accounts and tokens exist, create one small adapter per platform:

```text
scripts/post-x.mjs
scripts/post-youtube.mjs
scripts/post-tiktok.mjs
scripts/post-reddit.mjs
```

Each adapter should:

- read one row from `marketing/generated/promo-calendar.csv`,
- refuse rows not marked `approved`,
- post once,
- write the platform post ID back to a log file,
- never auto-retry blindly.

Keep secrets out of the repo:

```text
X_ACCESS_TOKEN
GOOGLE_OAUTH_REFRESH_TOKEN
TIKTOK_ACCESS_TOKEN
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
```

## Rule

Automate preparation and measurement first. Automate posting only through
official APIs or account-approved schedulers. Never automate spam.
