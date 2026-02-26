# Analytics Events Specification

**Version:** 2.0.0
**Date:** 2026-02-26
**Status:** Draft — Clean-slate redesign (no legacy constraints)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Architecture & Identity](#2-architecture--identity)
3. [Naming & Property Conventions](#3-naming--property-conventions)
4. [Global Properties](#4-global-properties)
5. [SDK Events](#5-sdk-events)
6. [Listener Events](#6-listener-events)
7. [Wallet App Events](#7-wallet-app-events)
8. [Business Dashboard Events](#8-business-dashboard-events)
9. [Backend Events](#9-backend-events)
10. [Funnels & KPI Mapping](#10-funnels--kpi-mapping)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Design Principles

### Why these events exist

Every event in this spec exists to answer one of these questions:

1. **Is Frak converting?** — exposure → activation → value funnel
2. **Is the reward loop working?** — earn → see → claim → share
3. **Are merchants succeeding?** — integration → campaign → payout
4. **What's breaking?** — errors, drop-offs, edge cases

If an event doesn't feed one of those questions, it doesn't belong.

### Design rules

| Rule | Rationale |
|------|-----------|
| **Properties over event names** | Use `auth_completed { method: "register" }` not `register_completed`. One funnel, segment by property. |
| **3 events per flow** | `started` → `completed` / `failed`. No intermediate noise unless it's a distinct funnel step. |
| **`snake_case` everything** | Event names, property keys, property values. No exceptions. |
| **Every event has a KPI owner** | If you can't name the KPI, delete the event. |
| **Fire once, enrich server-side** | Don't duplicate frontend + backend events for the same action. Pick the authoritative source. |

### Event count target

| Priority | Target | Purpose |
|----------|--------|---------|
| **P0** | ~35 events | Core funnels, all 7 KPIs measurable |
| **P1** | ~30 events | Secondary flows, merchant dashboard, error monitoring |
| **P2** | ~20 events | Deep analytics, edge cases, nice-to-have |
| **Total** | **~85 events** | Full-stack coverage without bloat |

---

## 2. Architecture & Identity

### Firing locations

| Location | Package | OpenPanel Client | Transport |
|----------|---------|-----------------|-----------|
| **SDK** | `sdk/core`, `sdk/components` | `OPEN_PANEL_SDK_CLIENT_ID` | Client-side (`@openpanel/web`) |
| **Listener** | `apps/listener`, `packages/wallet-shared` | `OPEN_PANEL_WALLET_CLIENT_ID` | Client-side (`@openpanel/web`) |
| **Wallet** | `apps/wallet`, `packages/wallet-shared` | `OPEN_PANEL_WALLET_CLIENT_ID` | Client-side (`@openpanel/web`) |
| **Business** | `apps/business` | `OPEN_PANEL_BUSINESS_CLIENT_ID` | Client-side (`@openpanel/web`) |
| **Backend** | `services/backend` | `OPEN_PANEL_BACKEND_CLIENT_ID` | Server-side (`@openpanel/sdk`) — **new** |

### Identity strategy

```
Anonymous visitor (pre-login)
  └─ profileId = deviceId (OpenPanel auto, rotates daily)

Authenticated user (post-login)
  └─ profileId = wallet address (0x...)
  └─ openPanel.identify({ profileId: wallet, properties: { session_type, auth_method } })
  └─ openPanel.setGlobalProperties({ wallet: address })

Backend events
  └─ profileId = wallet address (from JWT) or identity_group_id (for anonymous)
```

**Identity call timing:** On every `auth_completed` event, immediately call:
```typescript
openPanel.identify({
    profileId: wallet.address,
    properties: {
        session_type: session.type ?? "webauthn",
        auth_method: method, // "register" | "login" | "sso" | "pairing"
    },
});
```

### Source-of-truth rules

| Data | Authoritative source | Why |
|------|---------------------|-----|
| User authenticated | **Backend** (`auth_completed` server-side) | Can't fake, has all session data |
| Interaction processed | **Backend** (`interaction_processed`) | Validated, deduplicated |
| Reward earned/settled | **Backend** (`reward_earned`, `reward_settled`) | Blockchain state |
| Purchase linked | **Backend** (`purchase_linked`) | Server-validated |
| UI displayed/clicked | **Frontend** (SDK/Listener/Wallet) | Only frontend knows what rendered |
| Modal flow | **Listener** (iframe) | Owns the modal lifecycle |
| Wallet actions | **Wallet app** | Owns the wallet UI |

---

## 3. Naming & Property Conventions

### Event naming

```
{object}_{past_tense_verb}

Examples:
  sdk_loaded
  auth_completed
  modal_closed
  reward_revealed
  campaign_published
```

- Always `snake_case`
- Always past tense (`completed` not `complete`, `loaded` not `load`)
- Object is the noun being acted on (`sdk`, `auth`, `modal`, `reward`, `campaign`)
- No status suffixes in the name — use an `outcome` property instead when a single event covers success/failure

### Property naming

```
snake_case for keys and enum values

Examples:
  { method: "register", session_type: "webauthn", wallet: "0x..." }
  { placement: "product_page", page_type: "pdp" }
  { outcome: "success", error_code: "PAYMASTER_REJECTED" }
```

### Common property dictionary

These property names are standardized. Use them exactly when applicable.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `wallet` | Address | User wallet address | `"0x742d..."` |
| `merchant_id` | Hex | Merchant identifier | `"0xabc..."` |
| `method` | string | Auth/action method | `"register"`, `"sso"` |
| `session_type` | string | Wallet session type | `"webauthn"`, `"ecdsa"` |
| `placement` | string | Where on merchant site | `"product_page"`, `"cart"` |
| `page_type` | string | Page category | `"pdp"`, `"checkout"`, `"home"` |
| `component` | string | UI component name | `"button_wallet"`, `"button_share"` |
| `outcome` | string | Result of an action | `"success"`, `"error"`, `"dismissed"` |
| `error` | string | Error message | Human-readable |
| `error_code` | string | Machine error code | `"WEBAUTHN_TIMEOUT"` |
| `duration_ms` | number | Time elapsed | `1250` |
| `amount` | number | Currency amount | `12.50` |
| `currency` | string | Currency code | `"USDC"`, `"EUR"` |
| `tx_hash` | Hex | Transaction hash | `"0xdef..."` |
| `platform` | string | Integration platform | `"shopify"`, `"woocommerce"` |
| `utm_source` | string | UTM source | `"google"` |
| `utm_medium` | string | UTM medium | `"cpc"` |
| `utm_campaign` | string | UTM campaign | `"summer_2026"` |

---

## 4. Global Properties

Set once per session/context. Automatically attached to every event.

### SDK (`sdk/core`)

```typescript
openPanel.setGlobalProperties({
    sdk_version: process.env.SDK_VERSION,
    merchant_domain: window.location.hostname,
});
```

### Listener / Wallet (`packages/wallet-shared`)

```typescript
openPanel.setGlobalProperties({
    is_iframe: boolean,
    is_pwa: boolean,
    referrer: string,       // iframe referrer or document.referrer
});

// Updated on auth:
openPanel.setGlobalProperties({
    wallet: session.address,
});

// Updated on embedded context:
openPanel.setGlobalProperties({
    merchant_id: resolvedMerchantId,
    context_url: sourceUrl,
});
```

### Business Dashboard (`apps/business`)

```typescript
openPanel.setGlobalProperties({
    merchant_id: currentMerchantId,
    admin_wallet: session.address,
});
```

### Backend (`services/backend`)

```typescript
// Server-side: set per-event, not global
// Every backend event MUST include: merchant_id, identity_group_id (when available)
```

---

## 5. SDK Events

Fired on the **merchant's website** via `sdk/core` and `sdk/components`.

### 5.1 Lifecycle

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 1 | `sdk_loaded` | `{ merchant_domain, sdk_version, has_referrer }` | Wallet Activation Rate | **P0** |
| 2 | `sdk_connected` | `{ merchant_domain, connection_time_ms }` | Technical | **P1** |
| 3 | `sdk_error` | `{ type: "init"\|"iframe_load"\|"rpc_error"\|"rpc_timeout", method?, error, error_code?, timeout_ms? }` | Technical | **P0** |

### 5.2 Component Visibility & Interaction

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 4 | `component_displayed` | `{ component: "button_wallet"\|"button_share"\|"embedded_wallet", placement, page_type }` | Reveal-to-Activation | **P0** |
| 5 | `component_clicked` | `{ component, placement, page_type, wallet_status: "connected"\|"not_connected" }` | Wallet Activation Rate | **P0** |

### 5.3 Wallet Status

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 6 | `wallet_status_changed` | `{ status: "connected"\|"not_connected", wallet?, has_interaction_token }` | Wallet Activation Rate | **P0** |

### 5.4 Interactions

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 7 | `interaction_sent` | `{ type: "arrival"\|"sharing"\|"custom", referrer_wallet?, landing_url?, utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?, custom_type? }` | Wallet Activation Rate, Incremental Conversion Lift | **P0** |

### 5.5 Referral (SDK-side orchestration)

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 8 | `referral_started` | `{ referrer_wallet, wallet_status, landing_url }` | Revenue per Activated Wallet | **P0** |
| 9 | `referral_completed` | `{ outcome: "success"\|"no_wallet"\|"self_referral"\|"no_referrer", referrer_wallet?, wallet? }` | Revenue per Activated Wallet | **P0** |
| 10 | `referral_failed` | `{ referrer_wallet, error, error_code }` | Technical | **P1** |

### 5.6 Deep Link & Share

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 11 | `deep_link_triggered` | `{ platform: "android"\|"ios", app_installed }` | Wallet Activation Rate | **P1** |
| 12 | `share_action` | `{ action: "modal_opened"\|"link_copied"\|"native_shared"\|"modal_closed", error? }` | Revenue per Activated Wallet | **P1** |

**SDK total: 12 events**

---

## 6. Listener Events

Fired inside the **Frak iframe** (`apps/listener`).

### 6.1 Authentication (unified)

Replaces all per-method auth events with a single set segmented by `method`.

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 13 | `auth_started` | `{ method: "register"\|"login"\|"sso"\|"pairing"\|"demo", trigger?: "global"\|"specific"\|"popup"\|"link"\|"mobile"\|"qr" }` | Wallet Activation Rate | **P0** |
| 14 | `auth_completed` | `{ method, wallet, session_type: "webauthn"\|"ecdsa"\|"distant_webauthn", is_new_user }` | Wallet Activation Rate | **P0** |
| 15 | `auth_failed` | `{ method, error, error_code, trigger? }` | Technical | **P0** |

> **On `auth_completed`**: Also call `openPanel.identify()` and `setGlobalProperties({ wallet })`. This is the single place where user identity is established.

### 6.2 Modal Flow

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 16 | `modal_opened` | `{ steps: string[], merchant_id, source_url, is_dismissible, target_interaction? }` | Wallet Activation Rate | **P0** |
| 17 | `modal_step_completed` | `{ step: "login"\|"siwe_authenticate"\|"send_transaction"\|"final", step_index, total_steps, duration_ms }` | Wallet Activation Rate | **P0** |
| 18 | `modal_closed` | `{ outcome: "completed"\|"dismissed", step_at_close, steps_completed: string[], total_duration_ms }` | Wallet Activation Rate | **P0** |

### 6.3 Reward Reveal (the "Aha Moment")

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 19 | `reward_revealed` | `{ merchant_id, amount, currency, reward_type: "cashback"\|"discount"\|"token", placement: "product_page"\|"cart"\|"post_purchase"\|"modal"\|"embedded", is_first_reveal }` | Reveal-to-Activation Rate | **P0** |
| 20 | `reward_tier_displayed` | `{ merchant_id, tier_name, tier_level, estimated_amount, currency }` | Wallet Activation with Value | **P1** |

### 6.4 Transaction & SIWE

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 21 | `transaction_resolved` | `{ outcome: "signed"\|"rejected"\|"error", tx_hash?, duration_ms?, error?, error_code?, merchant_id }` | Incremental Conversion Lift | **P1** |
| 22 | `siwe_resolved` | `{ outcome: "signed"\|"rejected", wallet?, domain? }` | Wallet Activation Rate | **P1** |

### 6.5 Sharing (Listener-side)

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 23 | `share_completed` | `{ method: "copy_link"\|"native_share", merchant_id, link }` | Revenue per Activated Wallet | **P1** |

### 6.6 Embedded Wallet

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 24 | `embedded_wallet_opened` | `{ merchant_id, context_url, has_session }` | Wallet Activation with Value | **P1** |
| 25 | `embedded_wallet_action` | `{ action: "view_rewards"\|"claim"\|"share"\|"settings", merchant_id }` | Reward Redemption Rate | **P2** |

### 6.7 Merchant Context

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 26 | `merchant_resolved` | `{ merchant_id, merchant_name, has_rewards, reward_tier_count }` | Technical | **P2** |

**Listener total: 14 events**

---

## 7. Wallet App Events

Fired inside the **wallet app** (`apps/wallet`).

### 7.1 Wallet Lifecycle

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 27 | `wallet_created` | `{ method: "webauthn"\|"demo"\|"ecdsa", session_type }` | Wallet Activation Rate | **P0** |
| 28 | `wallet_recovered` | `{ method: "passkey"\|"backup"\|"pairing" }` | Wallet Activation Rate | **P1** |
| 29 | `session_ended` | `{ reason: "logout"\|"expired"\|"cleared" }` | — | **P1** |

### 7.2 Reward Claim (user-initiated)

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 30 | `reward_viewed` | `{ scope: "list"\|"detail", merchant_id?, reward_status?: "pending"\|"claimable"\|"claimed"\|"expired", amount?, currency?, total_claimable? }` | Reward Redemption Rate | **P0** |
| 31 | `reward_claim_started` | `{ merchant_id, amount, currency }` | Reward Redemption Rate | **P0** |
| 32 | `reward_claim_resolved` | `{ outcome: "success"\|"error", merchant_id, amount, currency, tx_hash?, error?, error_code? }` | Reward Redemption Rate | **P0** |

### 7.3 PWA & App Context

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 33 | `pwa_install_resolved` | `{ outcome: "accepted"\|"dismissed"\|"prompted" }` | — | **P1** |
| 34 | `browser_redirect` | `{ browser, action: "redirect"\|"copy_url"\|"dismissed" }` | Technical | **P1** |

### 7.4 Profile & Settings

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 35 | `profile_updated` | `{ fields: string[] }` | — | **P2** |

### 7.5 Token Operations

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 36 | `transfer_resolved` | `{ outcome: "success"\|"error", token, amount, tx_hash?, error? }` | — | **P2** |

### 7.6 Notifications

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 37 | `push_permission_resolved` | `{ outcome: "granted"\|"denied" }` | — | **P2** |
| 38 | `push_notification_tapped` | `{ notification_type, destination }` | — | **P2** |

### 7.7 Pairing

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 39 | `pairing_resolved` | `{ outcome: "connected"\|"disconnected"\|"error", pairing_id? }` | Wallet Activation Rate | **P2** |

**Wallet total: 13 events**

---

## 8. Business Dashboard Events

Fired inside the **business dashboard** (`apps/business`).

### 8.1 Merchant Onboarding

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 40 | `merchant_registered` | `{ merchant_id, admin_wallet }` | Merchant Adoption | **P0** |
| 41 | `merchant_setup_completed` | `{ merchant_id, has_logo, has_domain, domain? }` | Merchant Adoption | **P1** |

### 8.2 Campaign Lifecycle

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 42 | `campaign_created` | `{ merchant_id, campaign_id, campaign_type, budget, reward_type }` | Merchant Adoption | **P0** |
| 43 | `campaign_creation_abandoned` | `{ merchant_id, step_abandoned_at }` | Merchant Adoption | **P1** |
| 44 | `campaign_published` | `{ merchant_id, campaign_id, budget }` | Merchant Adoption | **P0** |
| 45 | `campaign_status_changed` | `{ merchant_id, campaign_id, old_status, new_status: "paused"\|"active"\|"archived", reason? }` | Merchant Adoption | **P1** |

### 8.3 Campaign Bank

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 46 | `bank_funded` | `{ merchant_id, amount, currency, tx_hash }` | Merchant Adoption | **P0** |
| 47 | `bank_low_balance` | `{ merchant_id, remaining_balance, currency }` | Merchant Adoption | **P1** |

### 8.4 Integration & Product

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 48 | `integration_code_copied` | `{ merchant_id, platform: "sdk"\|"shopify"\|"woocommerce"\|"custom" }` | Merchant Adoption | **P0** |
| 49 | `product_configured` | `{ merchant_id, product_id, config_type }` | Merchant Adoption | **P1** |

### 8.5 Dashboard Usage

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 50 | `dashboard_viewed` | `{ merchant_id, section: "overview"\|"campaign_detail"\|"members"\|"settings", active_campaigns? }` | Merchant Adoption | **P1** |
| 51 | `report_exported` | `{ merchant_id, format, date_range }` | Merchant Adoption | **P2** |

### 8.6 Team & Auth

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 52 | `business_session_started` | `{ admin_wallet, merchant_count }` | Merchant Adoption | **P1** |
| 53 | `team_member_changed` | `{ merchant_id, action: "invited"\|"removed", role? }` | Merchant Adoption | **P2** |

**Business total: 14 events**

---

## 9. Backend Events

Fired server-side via `@openpanel/sdk`. These are the **source of truth** for business-critical data. Every backend event MUST include `merchant_id` and `identity_group_id` when available.

### 9.1 Identity

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 54 | `identity_resolved` | `{ identity_group_id, node_type: "wallet"\|"merchant_customer"\|"anonymous_fingerprint", merchant_id, is_new_group }` | Wallet Activation Rate | **P0** |
| 55 | `identity_merged` | `{ source_group_id, target_group_id, wallet, merchant_id, node_count_merged }` | Wallet Activation Rate | **P1** |

### 9.2 Authentication (server-side)

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 56 | `auth_registered` | `{ wallet, authenticator_id, device_type, transports: string[] }` | Wallet Activation Rate | **P0** |
| 57 | `auth_logged_in` | `{ wallet, authenticator_id, session_type }` | Wallet Activation Rate | **P1** |

### 9.3 Interaction Processing

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 58 | `interaction_processed` | `{ type: "arrival"\|"sharing"\|"custom", merchant_id, identity_group_id, has_referrer, referrer_wallet?, source_url?, utm_source?, client_id, custom_type? }` | Wallet Activation Rate, Incremental Conversion Lift | **P0** |

### 9.4 Referral Chain

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 59 | `referral_registered` | `{ merchant_id, referrer_wallet, referee_group_id, chain_depth }` | Revenue per Activated Wallet | **P0** |
| 60 | `referral_blocked` | `{ merchant_id, reason: "self_referral"\|"cycle_detected", wallet? }` | Technical | **P2** |

### 9.5 Reward Lifecycle

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 61 | `reward_earned` | `{ merchant_id, campaign_id, identity_group_id, amount, currency, reward_type: "fixed"\|"percentage"\|"tiered"\|"chained", chain_depth?, interaction_type }` | Revenue per Activated Wallet | **P0** |
| 62 | `reward_settled` | `{ merchant_id, batch_size, total_amount, currency, tx_hash }` | Reward Redemption Rate | **P0** |
| 63 | `reward_settlement_failed` | `{ merchant_id, error, error_code, batch_size, total_amount, tx_hash? }` | Technical | **P0** |
| 64 | `reward_expired` | `{ merchant_id, identity_group_id, amount, currency, days_since_created }` | Reward Redemption Rate | **P1** |

### 9.6 Purchase Processing

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 65 | `purchase_received` | `{ merchant_id, order_id, amount, currency, platform: "shopify"\|"woocommerce"\|"custom", item_count }` | Incremental Conversion Lift | **P0** |
| 66 | `purchase_linked` | `{ merchant_id, order_id, identity_group_id, wallet?, amount, currency }` | Incremental Conversion Lift | **P0** |
| 67 | `purchase_link_failed` | `{ merchant_id, order_id, error, error_code }` | Technical | **P1** |
| 68 | `webhook_received` | `{ merchant_id, platform, event_type, order_id }` | Technical | **P1** |

### 9.7 Campaign (Backend lifecycle)

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 69 | `campaign_rule_evaluated` | `{ merchant_id, campaign_id, identity_group_id, interaction_type, matched, reward_amount? }` | Revenue per Activated Wallet | **P1** |
| 70 | `campaign_budget_depleted` | `{ merchant_id, campaign_id, total_spent }` | Merchant Adoption | **P1** |

### 9.8 Infrastructure Errors

| # | Event | Properties | KPI | Pri |
|---|-------|-----------|-----|-----|
| 71 | `infra_error` | `{ category: "erc4337"\|"paymaster"\|"bundler"\|"rpc"\|"gas", error, error_code, method?, chain_id?, provider?, tx_hash?, revert_reason? }` | Technical | **P0** |

**Backend total: 18 events**

---

## 10. Funnels & KPI Mapping

### 10.1 Primary Funnel: Exposure → Activation → Value Realized

```
 ┌─ sdk_loaded ─────────────────────────────────── 100% baseline
 │
 ├─ component_displayed ────────────────────────── Impression
 │
 ├─ component_clicked ──────────────────────────── Engagement
 │
 ├─ modal_opened ───────────────────────────────── Intent
 │
 ├─ auth_completed { method: "register" } ──────── Activation
 │
 ├─ reward_revealed ────────────────────────────── Value Perceived
 │
 ├─ reward_claim_started ───────────────────────── Value Initiated
 │
 └─ reward_claim_resolved { outcome: "success" }── Value Realized
```

**Segmentation axes:**
- `placement` on `component_displayed` and `reward_revealed` → Reveal-by-Placement analysis
- `method` on `auth_completed` → per-auth-method conversion
- `merchant_id` → per-merchant performance

### 10.2 Referral Funnel

```
 ┌─ referral_started ───────────────── Referral link landed
 │
 ├─ interaction_processed { type: "arrival", has_referrer: true }
 │                                      ── Backend attribution confirmed
 │
 ├─ referral_registered ────────────── Chain recorded
 │
 ├─ referral_completed { outcome: "success" }
 │                                      ── Referee activated
 │
 ├─ reward_earned ──────────────────── Referrer earns reward
 │
 └─ reward_settled ─────────────────── Referrer paid on-chain
```

### 10.3 Purchase → Reward Funnel

```
 ┌─ webhook_received ───────────────── Purchase detected (Shopify/WC/Custom)
 │
 ├─ purchase_received ──────────────── Purchase validated
 │
 ├─ purchase_linked ────────────────── Linked to Frak identity
 │
 ├─ campaign_rule_evaluated { matched: true }
 │                                      ── Eligible for reward
 │
 ├─ reward_earned ──────────────────── Amount calculated
 │
 ├─ reward_settled ─────────────────── On-chain settlement
 │
 └─ reward_claim_resolved { outcome: "success" }
                                        ── User claimed in wallet
```

### 10.4 Merchant Campaign Funnel

```
 ┌─ merchant_registered ────────────── Merchant joins
 │
 ├─ campaign_created ───────────────── Campaign configured
 │
 ├─ bank_funded ────────────────────── Budget deposited
 │
 ├─ campaign_published ─────────────── Goes live
 │
 ├─ interaction_processed ──────────── First user interaction
 │
 └─ reward_settled ─────────────────── First payout
```

### 10.5 KPI Formulas

#### Wallet Activation Rate

```
COUNT(DISTINCT wallet FROM auth_completed WHERE method = "register")
────────────────────────────────────────────────────────────────────
COUNT(DISTINCT profileId FROM sdk_loaded)
```

Events: `sdk_loaded`, `auth_completed`

#### Wallet Activation with Value Realized

```
COUNT(DISTINCT wallet FROM reward_claim_resolved WHERE outcome = "success")
─────────────────────────────────────────────────────────────────────────────
COUNT(DISTINCT wallet FROM auth_completed)
```

Events: `auth_completed`, `reward_claim_resolved`

#### Reveal-to-Activation Rate

```
COUNT(DISTINCT profileId FROM auth_completed
    WHERE profileId IN (SELECT profileId FROM reward_revealed))
──────────────────────────────────────────────────────────────────
COUNT(DISTINCT profileId FROM reward_revealed)

Segment by: reward_revealed.placement
```

Events: `reward_revealed`, `auth_completed`

#### Incremental Conversion Lift

```
ConversionRate(users with interaction_processed) - ConversionRate(control)
────────────────────────────────────────────────────────────────────────────
ConversionRate(control)
```

Events: `interaction_processed`, `purchase_received`, `purchase_linked`

#### Average Reward Redemption Rate

```
COUNT(reward_claim_resolved WHERE outcome = "success")
──────────────────────────────────────────────────────
COUNT(reward_earned)

Segment by: reward_type, merchant_id
```

Events: `reward_earned`, `reward_claim_resolved`

#### Revenue per Activated Wallet

```
SUM(purchase_linked.amount)
───────────────────────────
COUNT(DISTINCT wallet FROM auth_completed WHERE method = "register")

Segment by: merchant_id, time_period
```

Events: `purchase_linked`, `auth_completed`

#### Merchant Adoption Satisfaction

```
Proxy signals:
- Time: merchant_registered → campaign_published (setup friction)
- Drop: campaign_creation_abandoned rate
- Engagement: dashboard_viewed frequency
- Commitment: bank_low_balance → bank_funded latency
```

Events: `merchant_registered`, `campaign_published`, `campaign_creation_abandoned`, `dashboard_viewed`, `bank_funded`, `bank_low_balance`

---

## 11. Implementation Plan

### Prerequisites

| Step | What | Where |
|------|------|-------|
| 1 | Add `@openpanel/sdk` (server-side) | `services/backend/package.json` |
| 2 | Create analytics wrapper for business app | `apps/business/src/module/common/utils/analytics.ts` |
| 3 | Replace `FrakEvent` type with new event names | `sdk/core/src/utils/trackEvent.ts` |
| 4 | Replace `AnalyticsAuthenticationType` with unified `auth_started/completed/failed` | `packages/wallet-shared/src/common/analytics/` |
| 5 | Replace `trackGenericEvent` with typed functions | `packages/wallet-shared/src/common/analytics/` |

### Existing code to delete

All current analytics events are replaced. Remove:

| File | What to remove |
|------|---------------|
| `packages/wallet-shared/src/common/analytics/index.ts` | `trackAuthInitiated`, `trackAuthCompleted`, `trackAuthFailed`, `trackGenericEvent` — rewrite with new event names |
| `packages/wallet-shared/src/common/analytics/types.ts` | `AnalyticsAuthenticationType` — replaced by `method` property on `auth_*` events |
| `sdk/core/src/utils/trackEvent.ts` | `FrakEvent` type union — replace with new event names |
| All `trackGenericEvent("sharing-copy-link")` etc. | Replace kebab-case calls with new `snake_case` events |
| All `trackAuthInitiated("login")` patterns | Replace with `trackEvent("auth_started", { method: "login" })` |

### Priority breakdown

#### P0 — Core funnels (Sprint 1–2)

35 events. After this sprint, all 7 KPIs are measurable.

| Location | Events | Count |
|----------|--------|-------|
| SDK | `sdk_loaded`, `sdk_error`, `component_displayed`, `component_clicked`, `wallet_status_changed`, `interaction_sent`, `referral_started`, `referral_completed` | 8 |
| Listener | `auth_started`, `auth_completed`, `auth_failed`, `modal_opened`, `modal_step_completed`, `modal_closed`, `reward_revealed` | 7 |
| Wallet | `wallet_created`, `reward_viewed`, `reward_claim_started`, `reward_claim_resolved` | 4 |
| Business | `merchant_registered`, `campaign_created`, `campaign_published`, `bank_funded`, `integration_code_copied` | 5 |
| Backend | `identity_resolved`, `auth_registered`, `interaction_processed`, `referral_registered`, `reward_earned`, `reward_settled`, `reward_settlement_failed`, `purchase_received`, `purchase_linked`, `infra_error` | 10 |
| **Total P0** | | **34** |

#### P1 — Secondary flows (Sprint 3–4)

30 events. Enhanced visibility and merchant dashboard depth.

| Location | Events | Count |
|----------|--------|-------|
| SDK | `sdk_connected`, `referral_failed`, `deep_link_triggered`, `share_action` | 4 |
| Listener | `reward_tier_displayed`, `transaction_resolved`, `siwe_resolved`, `share_completed`, `embedded_wallet_opened` | 5 |
| Wallet | `wallet_recovered`, `session_ended`, `pwa_install_resolved`, `browser_redirect` | 4 |
| Business | `merchant_setup_completed`, `campaign_creation_abandoned`, `campaign_status_changed`, `bank_low_balance`, `product_configured`, `dashboard_viewed`, `business_session_started` | 7 |
| Backend | `identity_merged`, `auth_logged_in`, `reward_expired`, `purchase_link_failed`, `webhook_received`, `campaign_rule_evaluated`, `campaign_budget_depleted` | 7 |
| **Total P1** | | **27** |

#### P2 — Deep analytics (Sprint 5+)

21 events. Edge cases and secondary surfaces.

| Location | Events | Count |
|----------|--------|-------|
| Listener | `embedded_wallet_action`, `merchant_resolved` | 2 |
| Wallet | `profile_updated`, `transfer_resolved`, `push_permission_resolved`, `push_notification_tapped`, `pairing_resolved` | 5 |
| Business | `report_exported`, `team_member_changed` | 2 |
| Backend | `referral_blocked` | 1 |
| **Total P2** | | **10** |

### Grand total

| Priority | Count | Cumulative |
|----------|-------|------------|
| P0 | 34 | 34 |
| P1 | 27 | 61 |
| P2 | 10 | 71 |
| **Total** | **71** | |

### Validation checklist

After implementation, verify:

- [ ] All 7 KPI formulas produce data (section 10.5)
- [ ] Primary funnel (section 10.1) shows ≥6 steps with data
- [ ] Referral funnel (section 10.2) shows end-to-end data
- [ ] Purchase funnel (section 10.3) has backend events flowing
- [ ] Merchant funnel (section 10.4) tracks from registration to payout
- [ ] `auth_completed` triggers `identify()` call in all auth paths
- [ ] Error events (`sdk_error`, `infra_error`) are firing for known error scenarios
- [ ] Global properties are set before first event fires (filter hack preserved)
- [ ] Server-side events include `merchant_id` and `identity_group_id`
- [ ] No event uses camelCase or kebab-case (grep for `-` and capital letters in event names)
