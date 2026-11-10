# EveryCation frontend

One TypeScript codebase for both EveryCation frontends.

| Path | What it is |
| --- | --- |
| `apps/mobile` | The traveller app. React Native, Expo, Expo Router. |
| `apps/admin` | The staff console. Next.js App Router. |
| `packages/shared` | Types, form rules (Zod), money helpers, sample data and the data layer (`api`). |
| `packages/tokens` | Brand colours, radii and font names used by both apps. |

## Run it

```bash
pnpm install
pnpm dev:admin     # console on http://localhost:3000 (any email, 8+ character password, any 6-digit code)
pnpm dev:mobile    # Expo dev server; press i, a or w
pnpm typecheck
```

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

Sample user starts signed in with a verified wallet. Wallet PIN in the sample: **2580**.

## Not wired yet

These need accounts, keys or native builds, so the screens are in place with a stand-in:

- **API**: everything reads `packages/shared/src/api.ts` sample data. Device state lives in `apps/mobile/src/lib/store.ts`.
- **Admin auth**: the session is a demo kept in the browser (`apps/admin/lib/session.ts`). Replace with the API's cookie session.
- **Map** (My travels → Map): placeholder pins. Add `@rnmapbox/maps` and a Mapbox token.
- **Recording** (Record a tip): timer and controls only. Add `expo-camera` and `expo-audio` capture and the upload.
- **Payments, BVN/NIN checks, bank name lookup, SMS codes, Google sign-in, Google Calendar sync, push**: UI and validation only.
- **Offline cache** (MMKV), **i18n**, **Sentry**, **PostHog**, **Maestro/Playwright test suites**: not added yet.
- **Travel packages and bookings**: left out on purpose; they are a later release.

## Notes on versions

- Expo SDK 58 and Next.js 16 were current when this was scaffolded. Read their upgrade notes before bumping.
- `@tanstack/react-table` is pinned to v8; v9 has a different API.
- `apps/mobile/tokens.cjs` mirrors `packages/tokens` for Tailwind. Update both when a colour changes.
