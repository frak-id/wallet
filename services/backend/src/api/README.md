# API layer

HTTP routes only — every route is an Elysia plugin that delegates to a domain
service (`src/domain/**`) or, for anything crossing domains, to an orchestrator
(`src/orchestration/**`). No business logic lives here.

Mounted in `src/index.ts`, in this order: `commonApi`, `businessApi`, `userApi`,
`externalApi`, then `legacyRouteMapper` (`src/legacyRoutes.ts`) which rewrites
the pre-BFF paths onto the routers below.

## Route map

| Prefix | Module | Consumer |
|---|---|---|
| `/common` | `common/` — airtable, adminWallet, rate, social, version | landing pages, internal |
| `/user/track` | `user/track/` — interaction tracking (anonymous OK) | SDK |
| `/user/identity` | `user/identity/` — `ensure`, `install-code`, `merge` | SDK, wallet |
| `/user/wallet` | `user/wallet/` — `auth`, `balance`, `rewards`, `referral`, `notifications`, `merge`, `pairings` | wallet app |
| `/user/merchant` | `user/merchant/` — resolve, estimated-rewards, explorer | SDK |
| `/user/affiliate` | `user/affiliate/` | SDK |
| `/business/auth` | `business/auth/` — login, `2fa`, `link`, `shopify`, `invite` | business dashboard |
| `/business/merchant` | `business/merchant/` — registration, campaigns, billing, admins, bank, media, webhooks, transfer | business dashboard |
| `/business/notifications`, `/business/funding` | `business/` | business dashboard |
| `/ext/merchant` | `external/merchant/webhook/` — shopify, woocommerce, magento, custom | e-commerce platforms |

## Shared pieces

- `middleware/` — Elysia plugins resolving sessions/identity for routes
  (`identity.ts`), plus `business/middleware/` for the business session and its
  `requireStepUp` / `platformAdminAuthenticated` / `requireMerchantAccess`
  macros.
- `schemas/` — Typebox request/response schemas for these routes, re-exporting
  the orchestration schemas that are part of the same wire contract. Published
  as `@frak-labs/backend-elysia/api/schemas`, so removing an export is a
  breaking change for the frontends.
