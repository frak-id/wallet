# Subscription campaigns: progressive rewards (Recharge first)

Status: plan, nothing built. Decisions agreed on 2026-11-24. No new table; four columns and three indexes on existing tables need their migration (DB team).
Inputs: the backend reward pipeline as of `dev` on 2026-11-24, the Recharge API v2 (`2021-11`) docs, Shopify Admin API `2026-10`.

## Decisions

- Recharge is the first provider. Subscriptions are resolved behind one interface, so Shopify-native subscription apps (Skio, Loop, Appstle, Shopify Subscriptions) and custom/WooCommerce/PrestaShop subscriptions plug in later without changing the model.
- A subscription campaign is a **purchase campaign** (the `sales` goal, `purchase` trigger) with subscriptions switched on. No new goal, no new trigger.
- Rewards are paid **per step, one step per paid billing cycle**; the subscription checkout is cycle 1. Each step can use any of the existing reward types: **fixed**, **percentage** of that cycle's payment, or **tiered** on that cycle's payment. Referrer and referee are configured separately.
- A **prepaid** charge counts one step per cycle it pays for (a 3-month prepaid charge = 3 steps, unlocked when the charge is paid, each priced on a third of the amount). The 0€ prepaid shipments that follow are not cycles.
- A cycle the merchant earned nothing on (product subtotal after discounts = 0, e.g. a 100% discount) does not count: the plan does not advance, nothing is cancelled.
- Cancelling and resubscribing **continues the count**. One plan per referee per merchant: a resubscription resumes it, never creates a second.
- The wallet shows the **full plan upfront** with paid / pending on the detail sheet. Fixed steps are exact; percentage and tiered steps are estimated from the checkout payment and shown "≈" until their cycle is paid.
- The **full plan is reserved from the campaign budget at creation** (both parties). Percentage/tiered steps are re-priced when their cycle is paid and the budget is trued up by the difference.
- After a cancellation the remainder stays pending. With no counted cycle for an **inactivity window** (merchant setting, default 90 days) the remaining steps expire and their budget returns. A later resubscription resumes from the step reached and reserves the remainder again if the budget allows.
- A **push notification** goes to each party when a step unlocks.

## In one paragraph

Every Shopify order already reaches our order webhook, renewals included. For a merchant with a connected subscription provider, an order that may be a subscription order is marked pending, and a resolver job asks the provider (Recharge's API) what it is: a checkout, a renewal, a prepaid shipment, or a plain order. Checkouts and renewals become `purchase` interactions carrying a `subscription` block; `interaction_logs` is the cycle ledger (idempotent per order, cancelled on refund). On a checkout, a subscription campaign writes the whole plan as held `asset_logs` rows numbered by `plan_step`, reserving the budget. From then on one idempotent function, `syncPlan`, derives the steps earned from the counted cycles and releases, re-prices, re-holds, extends or re-arms the plan's rows to match. Renewal interactions go through the existing reward cron, which runs `syncPlan` for them instead of evaluating campaigns.

## Storage: no new table

| Table | Change | Holds |
|---|---|---|
| `merchant_webhooks` | `subscription_provider text`, `subscription_credentials text` (encrypted) | Which provider resolves this merchant's orders, and its API token. One row per merchant already, the row that receives its orders. |
| `purchases` | `subscription jsonb`; index on (`webhook_id`, `external_customer_id`); partial index on `subscription->>'state' = 'pending'` | Resolution state and result per order: `{ state: pending \| resolved \| unresolved, attempts, nextAttemptAt, kind, providerSubscriptionIds, cyclesCovered, merchandiseAmount }` |
| `asset_logs` | `plan_step integer`; partial unique index on (`interaction_log_id`, `campaign_rule_id`, `recipient_type`, `plan_step`) over live statuses | One row per step and recipient. The plan is the rows sharing an interaction (the checkout) and a campaign: no plan table. The index stops a re-arm from duplicating a step. |
| `interaction_logs` | none (payload gains `subscription`) | The cycle ledger: `{ kind: checkout \| renewal, cyclesCovered, merchandiseAmount, counted, providerSubscriptionIds }`. `external_event_id` makes each order count once; `cancelled_at` removes a refunded cycle. |

The token is encrypted like the Monerium and Instagram tokens (`MoneriumTokenCipher` pattern). No identity-group column is added anywhere, so `IdentityMergeService` needs nothing new.

**Counting** (derived, never stored): `stepsEarned = min(planLength, Σ cyclesCovered)` over the referee's `purchase` interactions at that merchant with `subscription.counted = true`, `cancelled_at IS NULL` and `created_at >= ` the plan's checkout interaction. Across subscriptions on purpose: that is "continue the count".

## What exists and is reused

- **Hold / release**: `asset_logs.held_at` / `released_at`, `AssetLogRepository.releaseHeld(items, graceMs)` (takes a `ready_at` per row, so a released step still waits for the campaign lockup) and `reholdReleased(ids)`, built for Frak Game missions. A held row shows as `locked` in the wallet, with `waitsOnFriend`. Note: `releaseHeld` only touches rows whose `expiresAt` is still in the future.
- **Expiry returns budget**: `RewardLifecycleOrchestrator` expires pending rows past `expires_at` and calls `restoreBudgetsBatch`. The inactivity window is the held rows' `expires_at`, pushed forward on each counted cycle.
- **Refunds**: a refunded Shopify order already calls `cancelForRefund`, which cancels its interaction by external id.
- **Deferral**: `BatchRewardOrchestrator` already leaves an interaction unprocessed for a later run (`deferForUnpriceableReward`); a pending subscription resolution uses the same path.
- **Notifications**: the `notification` event and `NotificationOrchestrator` templates (`reward_pending`, `reward_settled`).
- **Attribution of the checkout**: it goes through Shopify's checkout, so the pixel claim or `_frak-client-id` links it as today.

## Step 0: dev-store spike (before any code)

One Shopify dev store with Recharge (Shopify Checkout Integration) and the dev Frak app. Run a monthly subscription with two renewals, a prepaid 3-month subscription, a renewal at 100% discount, a refund, a cancellation and a resubscription. Save every payload as fixtures.

1. **Does `_frak-client-id` reach renewal orders?** If it does, every renewal of a referred subscriber is already rewarded today as a purchase. Then ship the renewal guard (below) as a standalone fix first, and check production for merchants on Recharge.
2. Renewal orders in our webhook: `source_name`, `line_items[].selling_plan_id` (Shopify says it can be `null` on renewals), `rc_*` note attributes, customer id.
3. Recharge lookup: does `GET /orders?external_order_id=<shopify id>` find the order, and how long after the Shopify webhook? Which fields give the product subtotal after discounts, and the prepaid ratio (`charge_interval_frequency / order_interval_frequency` on the subscription)?
4. Do refunds made in Recharge reach the Shopify order (so our existing refund path sees them)?

## Resolving subscription orders

`SubscriptionResolver` interface, one implementation per provider: `resolve(order) → { kind: "none" | "checkout" | "renewal" | "prepaid_shipment", providerSubscriptionIds, cyclesCovered, merchandiseAmount } | "retry"`.

**Candidates** (in `shopifyWebhook.ts`, only when the merchant has a `subscription_provider`): an order is a candidate if a line has a `selling_plan_id`, or its Shopify customer already has a resolved subscription order at this merchant (the new `purchases` index). A candidate's purchase is stored with `subscription.state = pending`. Every other order is untouched.

**Interactions stay where they are**: the claim and cart-attribute paths run as today, and `PurchaseInteractionCreator` copies `subscription` from the purchase into the payload. `BatchRewardOrchestrator` defers any interaction whose subscription is still pending.

**Resolver job** (`jobs/subscriptionResolution.ts`, every minute, advisory lock): takes due pending purchases, calls the resolver, retries with backoff (1 min → 2 h), and after 24 h marks them `unresolved`. Then, by result:

| Result | Effect |
|---|---|
| `none` or `unresolved` | The order is a plain purchase; its interaction, if any, proceeds as one. A failed renewal resolution is dropped: under-rewarding is the safe direction. |
| `checkout` | Interaction proceeds with `subscription.kind = checkout`. |
| `renewal` | If an interaction exists (cart attribute carried over), its payload becomes `kind = renewal`. Otherwise one is created for the subscriber: identity from the purchase of the same provider subscription id, else the latest linked subscription order of the same Shopify customer at this merchant. `counted = merchandiseAmount > 0`. |
| `prepaid_shipment` | Any interaction is closed with no reward and `counted = false`. |

Each update emits `newInteraction`.

**Renewal guard**: renewals must never be rewarded as purchases. For connected merchants, the deferral above does this. For merchants running Recharge without connecting it, add a sync guard on the renewal signal the spike confirms (`source_name`, `rc_*`), which skips the claim/cart-attribute path.

### Recharge resolver (v1)

- **Connection**: in the Shopify app, the merchant pastes a Recharge API token (`read_orders`, `read_subscriptions`). The backend checks it against Recharge, then stores it encrypted with `subscription_provider = recharge`. Disconnecting clears both. The Recharge Technology Partner OAuth replaces the pasted token later; apply now, acceptance takes time.
- **Lookup**: `GET /orders?external_order_id=<id>` gives `type` (`checkout` / `recurring`), `is_prepaid`, line items with `purchase_item_type` and `purchase_item_id` (subscription id), and the amounts; `GET /subscriptions/<id>` gives the intervals for `cyclesCovered`. Not found yet: `retry`. A prepaid shipment is a `recurring` order whose charge was already counted (exact test from the spike).
- No Recharge webhooks: payments come in as Shopify orders, refunds through the Shopify order, and cancellations need no event since the inactivity window handles them. No endpoint, no signature check, no health job.
- Errors (revoked token, 401) are kept on the merchant webhook row and shown in the Shopify app card.

### Later resolvers

- **Shopify-native** (Skio, Loop, Appstle, Shopify Subscriptions): no API call. `selling_plan_id` → checkout; renewal signal (`source_name`) + known subscriber → renewal; `cyclesCovered = 1`.
- **Custom webhook**: optional `subscription { kind, id, cyclesCovered }` block on `CustomWebhookDto`, for WooCommerce Subscriptions, PrestaShop and headless merchants. Resolved on receipt, no job.

## Reward engine

- **Rule**: `subscription?: { inactivityDays }` on `CampaignRuleDefinition` (default 90). When set, the campaign only matches checkouts (`purchase.subscription.kind = checkout`, implicit), and every reward definition carries a cycle range.
- **Reward**: optional `cycles?: { from, to }` on the three existing reward definitions (1 ≤ from ≤ to ≤ 24). "10 then 5 for 4 renewals" for the referrer is a fixed `10` on `{1,1}` and a fixed `5` on `{2,5}`; percentage and tiered work the same way. Publish validation: ranges required on a subscription campaign, forbidden otherwise, no overlap per recipient, no `chaining`.
- **Context**: `PurchaseContext.subscription = { kind, cyclesCovered }` (built by `InteractionContextBuilder`), and `isSubscription` for regular campaigns that want to exclude subscription checkouts.
- **Plan creation** (checkout interaction, subscription campaign matched, the referee has no plan at this merchant, under an advisory lock on merchant + referee): `RewardCalculator` prices every step of every definition. The basis is the checkout's per-cycle amount (`merchandiseAmount / cyclesCovered`) for all steps, which is exact for step 1 and an estimate for later percentage/tiered steps. `RuleEngineService.consumeBudget` reserves the sum, unchanged. `BatchRewardOrchestrator` inserts one held row per step and recipient (`plan_step`, `expires_at = checkout + inactivityDays`) in its existing transaction, then calls `syncPlan` after commit.
- **Resubscription checkout** (plan exists): no evaluation; it counts as a cycle and runs `syncPlan`.
- **Renewal interaction**: no evaluation; `syncPlan`, then marked processed. Regular campaigns never see renewals.
- **Caps**: `countByCampaignsAndUserAsReferee` / `countByMerchantAndUserAsReferee` count rows, so a 5-step plan would count 5. Count `plan_step IS NULL OR plan_step = 1`.
- **Frak referral policy** (`resolveFrakReferralRewards`): plan rows skip the welcome-bonus redirect in v1.

## `syncPlan`: the one reconciler

`orchestration/reward/SubscriptionPlanOrchestrator.syncPlan(merchantId, refereeIdentityGroupId)`, idempotent, one transaction, `FOR UPDATE` on the plan's rows:

1. List the counted, uncancelled cycles since the anchor, in order, and map each step to the cycle that earns it. `earned` = the number of steps mapped.
2. **Re-price** each held step that is newly earned and comes from a percentage/tiered definition: recompute it on its cycle's per-cycle amount (definition looked up by campaign, recipient and step). If it rises, `consumeBudget` the difference, and keep the reserved amount if the budget is short. If it falls, restore the difference. FX unavailable → the interaction is deferred, as purchases are today.
3. **Release** held rows with `plan_step ≤ earned` (`releaseHeld`, `ready_at = cycle paid at + campaign lockup`).
4. **Re-hold** released, unsettled rows with `plan_step > earned` (`reholdReleased`): a refunded cycle takes its step back while it is unpaid. A settled step stays paid, as with purchase refunds today.
5. **Extend** held rows: `expires_at = last counted cycle + inactivityDays`.
6. **Re-arm**: steps that exist only as `expired` rows, when a cycle was counted after their expiry, get fresh held rows with their budget consumed; if the budget is short, skip and log, and the next cycle retries.
7. After commit, emit `reward_step_unlocked` for the rows released in step 3.

Called from: plan creation, renewal and resubscription interactions (reward cron), and `cancelForRefund` when the cancelled interaction carries a `subscription` block.

## Notifications

New `reward_step_unlocked` event type and `NotificationOrchestrator` template, batched per recipient per sync: referrer "Your friend renewed their subscription: +5 € unlocked at {merchant}", referee "+5 € unlocked at {merchant}". Plan creation keeps `reward_pending`, counted per plan rather than per row (5 rows ≠ "5 rewards").

## Business dashboard

- **Goal**: unchanged, `sales`. The reward step gets a "Subscriptions" switch, shown when the merchant has a provider connected (exposed on the merchant read endpoint).
- **Reward step, switch on**: the usual model (fixed / percentage / tiered) and recipients, with a **first payment** value and an **each renewal** value per side, and a **renewals rewarded** count. Tiered: the tiers are defined once, and each tier has a first payment amount and a renewal amount. Plus the inactivity window and lockup. This writes two ranged definitions per side (`{1,1}` and `{2, 1 + renewals}`); the stored model allows any ranges for later.
- **Totals**: plan total per side and combined CPA; "≈" when percentage or tiered.
- **Budget step**: says the full plan is reserved per new subscriber.
- **Regular sales campaigns**: an "Exclude subscription orders" toggle (`purchase.isSubscription neq true`).
- **Details sheet** (`CampaignDetailsSheet/ConfigTab`): first payment / renewals rendering. Stats: live plans, steps paid, reserved vs paid.

## Shopify app

A "Subscriptions" card in settings: pick Recharge, paste the token, see the status and last error, disconnect. Optional, so not in the onboarding wizard (`utils/onboarding.ts`). The token goes straight to the backend; the Shopify app stores nothing.

## Wallet

- **History**: `RewardHistoryOrchestrator` collapses a plan's rows (same interaction, campaign and recipient, `plan_step` set) into one item: `amount` = plan total, and a new optional `plan`: `{ stepsEarned, stepsTotal, paidAmount, pendingAmount, estimated, state: "active" | "expired" | "completed", steps: [{ step, amount, estimated, status, availableAt?, settledAt? }] }`. Paid = settled; pending = everything else still live.
- **Detail sheet** (`RewardDetailModal`): the total (with "≈" if estimated), paid / pending, then the steps: paid, unlocking on a date, upcoming, expired. **Privacy**: the referrer is never told their friend cancelled; an upcoming step reads "unlocks at the next renewal".
- **Unpaid total** (`getUnpaidTotal`): treat upcoming steps the way held game rewards are treated today.
- i18n in `packages/wallet-shared/src/i18n/locales/`, then `bun run i18n:types`.

## SDK and estimated rewards

- `EstimatedRewardItem` gets an optional `subscription` block (first payment and renewal rewards, renewals count); `BestReward.formatted` reads "up to 30 €" (fixed) or "up to 20 % per payment". Mirror it in `sdk/core` (`rewards/select.ts`, types) and regenerate `user-openapi.json`.
- The native SDKs (1.0.0, semver) decode this payload: confirm they ignore an unknown field before shipping, or leave subscription campaigns out of `best` for native callers.

## Analytics

`productEvents`: `subscription_order_resolved` (kind, provider), `subscription_plan_created`, `subscription_step_unlocked`, `subscription_step_repriced` (delta), `subscription_plan_expired`, `subscription_plan_rearmed`.

## Tests

- `syncPlan`: monthly, prepaid, 0€ cycle, refund before and after settlement, cancel then resubscribe, expiry then resubscribe with and without budget, re-pricing up / down / budget short, concurrent syncs.
- Resolver job: each result kind, retry and give-up, an interaction created before resolution, renewal identity by subscription id then customer id. Recharge resolver against the spike fixtures.
- Publish validation of cycle ranges; `RewardCalculator` on ranged definitions; caps counting step 1 only.
- History grouping; `RewardDetailModal` states; wizard `utils.ts` round-trip of first payment / renewal values for each model.

## Sequencing

1. Spike. If renewals carry `_frak-client-id`: renewal guard as a standalone fix.
2. Columns migration (DB team), `SubscriptionResolver` + Recharge, resolver job, Shopify app card. Resolution only, no reward: watch real orders on the dev store.
3. Engine: ranged rewards, plan creation, `syncPlan`, re-pricing, caps fix, step notifications.
4. Business wizard and details sheet.
5. Wallet history and detail sheet; SDK estimated reward.
6. One pilot merchant.

## Not done (v1)

- Shopify-native and custom-webhook resolvers (designed above, built after Recharge).
- Recharge partner OAuth (pasted token until accepted).
- Frak referral codes and referral chaining on subscription plans.
