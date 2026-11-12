# EveryCation

One TypeScript codebase for the EveryCation apps and API.

| Path | What it is |
| --- | --- |
| `apps/mobile` | The traveller app. React Native, Expo, Expo Router. |
| `apps/admin` | The staff console. Next.js App Router. |
| `apps/api` | The backend. NestJS, PostgreSQL, Drizzle. Sign-in and the wallet ledger so far. |
| `packages/shared` | Types, form rules (Zod), money helpers, sample data and the data layer (`api`). |
| `packages/tokens` | Brand colours, radii and font names used by both apps. |

## Run it

```bash
pnpm install
pnpm dev:admin     # console on http://localhost:3000 (any email, 8+ character password, any 6-digit code)
pnpm dev:mobile    # Expo dev server; press i, a or w
pnpm typecheck
```

## API (`apps/api`)

```bash
docker compose up -d                      # PostgreSQL 16 with the dev and test databases
cp apps/api/.env.example apps/api/.env    # then set the three secrets
pnpm --filter @everycation/api build
pnpm --filter @everycation/api db:migrate
pnpm dev:api                              # http://localhost:4000/v1, docs at /docs
pnpm --filter @everycation/api test       # needs the test database running
```

Built so far:

- **Sign-in**: 6-digit code by email (set `SMTP_URL` to send through any mail provider), 15-minute access tokens, rotating refresh tokens (reusing an old one ends the session).
- **Wallet setup**: BVN/NIN check, 4-digit PIN (Argon2id, locks after 3 wrong tries), bank account in the customer's own name.
- **Wallet**: balances, savings goals (lock, move in and out), history, freeze.
- **Money in**: signed partner webhook, credited once however often it is delivered.
- **Withdrawals**: PIN, daily limit of ₦300,000 and 24-hour new-bank rule (both hold the request for Finance), paid or returned on the partner's verdict.
- **Ledger**: double entry in whole kobo. The database itself refuses an overdraft, an unbalanced transaction and any edit to past entries.

- **Tips**: post, like, comment, search; guests can read.
- **Advice**: always starts in review. It shows as Verified only after a moderator approves it; three reports from different people send verified advice back for re-review.
- **Staff**: password plus authenticator code, sessions that end after 12 hours, a role table enforced on every route, and an audit log of every decision.
- **Finance**: totals from the ledger, held withdrawals to release or reject, and the ledger itself.

```bash
pnpm --filter @everycation/api db:seed                                   # sample travellers, tips, advice and one staff account (development only)
pnpm --filter @everycation/api admin:create you@company.com "Your Name" super_admin
pnpm --filter @everycation/api admin:code admin@everycation.app          # the current authenticator code, development only
```

The seed prints the development staff sign-in. For the console, set `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/v1`).

Money endpoints require an `Idempotency-Key` header. Outside production the code request returns `devCode`, and without `SMTP_URL` the email is written to the log.

Stand-ins to replace when partners are chosen: `modules/wallet/partners.ts` (identity and bank lookup), `modules/wallet/webhook.controller.ts` (event format). Follow-up work is written to the `outbox` table; the worker that sends it (BullMQ) is not built yet.

To change the schema: edit `src/db/schema.ts`, run `pnpm --filter @everycation/api db:generate`, review the SQL in `apps/api/drizzle`, then `db:migrate`.

## Data

Both apps read through `api` in `packages/shared/src/api.ts`. It returns sample data today.
Replace the function bodies with the client generated from the API's OpenAPI document; screens stay as they are.

Money is whole kobo everywhere (`naira(7500)` is ₦7,500). Use `formatNaira` to show it.
The two locked rules live in `packages/shared/src/money.ts`: the 25% plan fee and the 06:00 WAT sale opening.

## What is built

**Admin console (`apps/admin`)**: sign-in with two-step code, Overview, Advice review, Reports, Places & content,
Users & KYC, Wallet & withdrawals, Creator payouts, Trip plans, Shop products, Shop orders, Notifications,
Admins & audit log, Settings. The sidebar and every page respect the role table in
`packages/shared/src/mock/admin.ts` (`permissions`).

**Mobile app (`apps/mobile`)**, 42 screens under `src/app` (Expo Router, one file per screen):

| Area | Screens |
| --- | --- |
| Start | welcome, sign-up, verify code |
| Tabs | Explore, Wallet, Shop, My travels (timeline, bucket list, calendar, map), Record a tip |
| Community | feed, tip, comments, traveller profile, my profile, settings, notifications, search, place |
| Advice | countries A to Z, country advice, share advice (goes to review) |
| Trip plans | browse, plan detail and buy, share or sell, creator studio |
| Trips | trip detail and itinerary, add to calendar |
| Wallet | add money, withdraw, PIN, receipt, history, new goal, goal detail, settings, identity check, create PIN, link bank |
| Shop | categories, product, basket, checkout, order tracking |

**Sign-in and the wallet are live against `apps/api`.** Start the API first, copy `apps/mobile/.env.example` to `.env`, then run the app.
Outside production the server shows the email code on the verify screen, and Add money has a "test money" button that stands in for the bank.
In the sandbox identity check any 11-digit number passes unless it starts with 000; a bank account starting 111 is "in another name" and 999 "does not exist".

Tips (Explore, Community, tip, comments, Record a tip) and travel advice (countries, country page, share) are live too. Search, places, traveller profiles, plans, trips and the shop still run on sample data. Buying a plan and placing a shop order charge nothing yet.

## What runs on the API now

**App:** sign-in, profile, wallet, tips with photo and video uploads, comments, travel advice, notifications, search, places, traveller profiles and following, trips with itineraries, the bucket list, trip plans (browse, buy, share, sell), creator studio, and the shop (products, basket, checkout from the wallet, order tracking).

**Console:** sign-in, Advice review, Reports, Wallet & withdrawals, Creator payouts, Shop orders, Admins & audit log (with staff invites).

## Not wired yet

- **Partners:** BVN/NIN, bank transfers, cards and delivery are stand-ins (`modules/wallet/partners.ts`, the webhook format). Delivery prices in `config.ts` are placeholders.
- **Media storage:** uploads are saved to disk (`MEDIA_DIR`). Swap `DiskStorage` for S3 and a CDN in production. Videos are stored as uploaded; there is no transcoding. Voice tips are not built.
- **Push and email:** notifications are in-app only. The `outbox` worker (BullMQ) is not built, so nothing is sent outside the app.
- **Scheduled work:** auto-saves and a Friday payout timer do not run by themselves. Finance approves payouts from the console.
- **Maps** are live (My travels → Map, trip pages, place pages) on free OpenStreetMap tiles from OpenFreeMap, drawn by MapLibre in `apps/mobile/src/ui/map-canvas.tsx`. No key is needed; set `EXPO_PUBLIC_MAP_STYLE_URL` to switch provider. Trips pin to a known place when the name matches, otherwise to the middle of the country; there is no address search yet.
- **Google and Apple sign-in** are built and switch themselves on when the server has the keys; until then the app hides the buttons. Google goes through the server (`/v1/auth/google/start` → Google → `/v1/auth/google/callback` → back into the app with a one-time code), so one Google Cloud "Web application" client covers iPhone, Android and web. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and add `PUBLIC_URL/v1/auth/google/callback` as the client's redirect URI. Apple needs `APPLE_AUDIENCES=app.everycation.mobile` and the Sign in with Apple capability on the App ID. Someone who signed in by email before keeps the same account.
- **Google Calendar sync** uses the same Google client with the Calendar API enabled and the `calendar.app.created` scope. It adds an "EveryCation trips" calendar and copies trips into it one way (`modules/calendar`). Refresh tokens are stored encrypted.
- **Place search** (`modules/geo`) suggests places staff added, then OpenStreetMap results from a Photon server (`GEOCODER_URL`, default the public photon.komoot.io, which is free but fair-use; host your own for launch).
- **Timed jobs** (`modules/jobs`) run inside the API twice a minute: scheduled notifications, plan-on-sale notices, calendar retries, trip reminders, automatic savings, goal reminders and housekeeping. Each run is claimed in the database, so several servers can run safely. Set `JOBS_ENABLED=0` on servers that should not run them. The console's Settings page shows each job's last run.
- **Console:** every page reads and writes the API. Notifications sends an in-app message to an audience (everyone, verified wallets, travelling soon, plan sellers, shop customers) and counts who read it. Settings changes the delivery fees, daily withdrawal limit, new-bank hold, lowest plan price and reports-before-re-review (`modules/settings`); the 25% fee and the other locked rules stay in `config.ts`. Removing a plan or a reported post needs a reason, which the author is told.
- **Voice tips:** recorded in the app with `expo-audio` (up to two minutes), uploaded like photos and video, and played on the tip page (`apps/mobile/src/ui/voice.tsx`).
- **Plans:** no ratings or reviews, and no refund flow when a plan is removed.
- **Offline cache, i18n, Sentry, PostHog, saved Maestro/Playwright suites.**
- **Travel packages and bookings:** left out on purpose; they are a later release.

## Notes on versions

- Expo SDK 58 and Next.js 16 were current when this was scaffolded. Read their upgrade notes before bumping.
- `@tanstack/react-table` is pinned to v8; v9 has a different API.
- `apps/mobile/tokens.cjs` mirrors `packages/tokens` for Tailwind. Update both when a colour changes.
