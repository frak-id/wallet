# Campaigns Overview — backend endpoint plan

Replace `apps/business/src/mock/campaignsOverview.json` with real backend data sourced from Postgres + OpenPanel (`/export/charts`).

## Current state

- **Frontend** `apps/business/src/module/campaigns/component/Overview/index.tsx` renders 6 cards from a single mock JSON.
- **Query** `campaignsOverviewQueryOptions({ merchantId, isDemoMode, from, to })` already threads ISO `yyyy-MM-dd` `from` / `to` into the query key (route validates search params). `queryFn` still returns the mock.
- **Backend** has zero overview endpoint. `CampaignStatsOrchestrator` aggregates lifetime per-campaign stats only — no time-windowing, no OpenPanel.
- **Env (`infra/gcp/secrets.ts`)** ready:
  - `OPEN_PANEL_API_URL` — self-hosted (`https://op-api.gcp.frak.id/` / `gcp-dev`)
  - `OPEN_PANEL_WALLET_PROJECT_ID` — single project (`wallet` / `wallet-dev`), holds SDK + wallet + listener events
  - `OPEN_PANEL_BACKEND_CLIENT_ID` / `OPEN_PANEL_BACKEND_CLIENT_SECRET` — read-mode client, already provisioned

## Target

Two `/business/merchant/:merchantId/campaigns/overview/*` endpoints, both accepting `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 30 days):

| Route | Source | Latency | Frontend boundary |
|---|---|---|---|
| `GET .../overview/summary` | Postgres only | fast (50–200 ms) | KPI row · Top campaigns · Purchases · Projected revenue |
| `GET .../overview/analytics` | OpenPanel + small DB joins | slow (0.5–3 s, rate-limited 100/10 s) | Funnels · Sharing breakdown |

Two endpoints (vs. one) because OpenPanel exports are slow + rate-limited. Splitting lets the KPI cards paint immediately while funnels/sharing stream in via independent `<Suspense>` boundaries. Existing single `campaignsOverviewQueryOptions` will be split into `overviewSummaryQueryOptions` + `overviewAnalyticsQueryOptions` (same input shape — `merchantId`, `isDemoMode`, `from`, `to`).

## Date range contract

- Both endpoints: optional `from` / `to` (ISO `yyyy-MM-dd`). When absent, server defaults to `[now-30d, now]`.
- Deltas (`kpis.*.delta`, `funnels.*.delta`) computed against a same-length window ending immediately before `from`. OpenPanel handles this natively via `previous=true`; Postgres queries run twice in parallel.
- Series cards (`purchases.series`, `projectedRevenue.series`) bucket by month if the window spans ≥60 days, otherwise by day. Bucket count caps at ~12 to keep charts readable.

## Mock → data source

| Mock key | Source |
|---|---|
| `kpis.ambassadors` | Postgres — distinct `identity_group_id` on `asset_logs` for the merchant in window |
| `kpis.shares` | OpenPanel — count `sharing_link_shared` + `sharing_link_copied` |
| `kpis.revenue` | Postgres — sum `purchases.total_price` via webhook → merchant, converted to USD (`pricingRepository`) |
| `kpis.sharingRate`, `avgCpa` | Backend derived from the above |
| `funnels.website[]` | OpenPanel (SDK events) + Postgres tail (`referredInteractions`, `purchaseInteractions`) |
| `funnels.wallet[]` | OpenPanel (wallet/listener events) + same Postgres tail |
| `topCampaigns[]` | Postgres — campaigns + per-campaign sharing rate (existing `CampaignStatsOrchestrator` logic, scoped to window). `status="ended"` is virtual: `expires_at < now OR budget_used >= budget_config`. |
| `statusBreakdown` | Postgres — `COUNT(*) GROUP BY status` on `campaign_rules` |
| `purchases.{total,avgPerMonth,series}` | Postgres — `purchases` joined by webhook→merchant, grouped by `date_trunc('month' or 'day', created_at)` |
| `projectedRevenue.actual` | Postgres — `SUM(asset_logs.amount)` per bucket, USD |
| `projectedRevenue.forecast` | Backend — simple linear regression on the last 3 buckets |
| `sharing.platform[]` | OpenPanel — `sharing_link_shared` broken down by `source` global prop, bucketed into `Merchant Site` / `Wallet App` per `SharingSource` enum |
| `sharing.device[]` | OpenPanel — same event, breakdown by auto-collected `device.type` |

## Funnel event mapping

Single OpenPanel project, so funnels are pure event-name filters.

**Website funnel** (3 OpenPanel steps + 2 backend steps):
1. `banner_impression` + `post_purchase_impression` → Share CTA seen
2. `share_button_clicked` → Share initiated
3. `sharing_link_shared` + `sharing_link_copied` → Link shared
4. Postgres `referredInteractions` → Referred
5. Postgres `purchaseInteractions` → Converted

**Wallet funnel** (4 OpenPanel steps + 2 backend steps):
1. `screen_view` on `/explorer*` paths → Explorer impressions
2. `wallet_modal_opened` where `modal in (explorerDetail, welcomeDetail)` → Brand page opened
3. `sharing_page_viewed` → Share initiated
4. `sharing_link_shared` / `sharing_link_copied` (wallet-context sources) → Link shared
5. Postgres `referredInteractions` → Referred
6. Postgres `purchaseInteractions` → Converted

All filters scoped by `merchant_id` event property (SDK events) or `contextMerchantId` global prop (wallet events — added in Phase 2).

## Phase 1 — Backend summary endpoint + FE summary swap

Ships the cheap part. Page becomes real for everything except funnels/sharing.

**Backend** — `services/backend/src/`:
- `orchestration/schemas/campaignOverviewSchemas.ts` (NEW) — TypeBox shapes for the summary slice.
- `orchestration/CampaignOverviewOrchestrator.ts` (NEW) — `getSummary(merchantId, { from, to })` with 4 parallel methods (`getKpis`, `getTopCampaignsAndBreakdown`, `getPurchasesSeries`, `getProjectedRevenueSeries`). Each runs current + previous window in parallel for deltas.
- `orchestration/context.ts` — wire the orchestrator.
- `api/business/merchant/campaignOverview.ts` (NEW) — `GET /:merchantId/campaigns/overview/summary` with `t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) })` query schema. Standard `businessSessionContext` + `hasMerchantAccess` auth.
- `api/business/merchant/index.ts` — register `merchantCampaignOverviewRoutes`.

**Frontend** — `apps/business/src/module/campaigns/`:
- `api/overviewApi.ts` (NEW) — `getOverviewSummary({ merchantId, isDemoMode, from, to })` via Eden Treaty. Demo branch returns a sliced view of the existing mock.
- `queries/queryOptions.ts` — replace `campaignsOverviewQueryOptions` with `overviewSummaryQueryOptions` (real call) + temporary `overviewAnalyticsQueryOptions` (still mock). Both already accept `from` / `to`. Gate `initialData` on `isDemoMode` (fixes the existing unconditional-seed anomaly).
- `component/Overview/index.tsx` — consume both query options, no Suspense split yet (analytics is still synchronous mock).
- `routes/.../overview.tsx` loader — `prefetchQuery` both.

## Phase 2 — `merchant_id` attribution on wallet events

Independent PR. Adds the missing attribution so the wallet funnel + sharing breakdown can be filtered server-side. Ship in parallel with Phase 1.

| File | Change |
|---|---|
| `packages/wallet-shared/src/common/analytics/events/modal.ts` | Add `merchant_id?: string` to `WalletModalEventMap.wallet_modal_opened`. |
| `apps/wallet/src/module/stores/modalStore.ts` (the `openModal` analytics subscriber) | For `explorerDetail` / `welcomeDetail` / `rewardDetail`, pull `merchant_id` from the modal state payload. |
| `apps/wallet/src/module/explorer/...ExplorerDetail` (on mount/unmount) | Call `updateGlobalProperties({ contextMerchantId })` so the `/explorer/m/*` `screen_view` is attributed. |
| Listener events | No client change — `productId` global prop is already on every listener event; backend resolves `productId → merchant_id` via `MerchantContext.repositories.merchant.findByProductId`. |

## Phase 3 — OpenPanel client + analytics endpoint

Lands once Phase 2 events have accumulated data (~24 h to a few days).

**Backend** — `services/backend/src/`:
- `infrastructure/integrations/openpanel/` (NEW folder, sibling to `airtable/`):
  - `OpenPanelExportClient.ts` — typed HTTP wrapper around `${OPEN_PANEL_API_URL}/export/charts` and `/export/events`. Sends `openpanel-client-id` / `openpanel-client-secret` headers. Single retry on 429.
  - `index.ts` — singleton constructed from the three env vars.
- `orchestration/CampaignAnalyticsOrchestrator.ts` (NEW) — `getAnalytics(merchantId, { from, to })` runs 4 OpenPanel calls in parallel (website funnel, wallet funnel, sharing platform, sharing device) + 1 DB call for the backend funnel tail, then merges into the response contract.
- `orchestration/schemas/campaignOverviewSchemas.ts` — extend with `OverviewAnalyticsSchema`.
- `api/business/merchant/campaignOverview.ts` — add `GET .../overview/analytics` route.

**Frontend** — `apps/business/src/module/campaigns/`:
- `api/overviewApi.ts` — add real `getOverviewAnalytics`.
- `queries/queryOptions.ts` — flip `overviewAnalyticsQueryOptions` `queryFn` to the real call.
- `component/Overview/index.tsx` — wrap `FunnelCard` and `SharingBySourceCard` in their own `<Suspense>` boundaries.
- `component/Overview/FunnelCardSkeleton.tsx`, `SharingBySourceSkeleton.tsx` (NEW) — placeholders matching the card silhouette.

## Open items

- **`projectedRevenue.forecast`** uses a 3-bucket linear extrapolation. Good enough as a v1; revisit if product wants something smarter.
- **Cache strategy** — TanStack Query `staleTime` stays at 5 min as today. Add server-side cache header (`Cache-Control: private, max-age=60`) on the analytics endpoint to soak repeat hits during a session.
