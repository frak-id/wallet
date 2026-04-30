# OpenPanel Tagging Plan — Product Team View

> **Audience:** product team — not engineering. This document is the canonical "what is tracked, when does it fire, and what does it unlock" reference. Engineering specs live in `docs/openpanel-events.md` (event names + properties) and `docs/openpanel-tagging-plan.md` (implementation).

---

## How to read this plan

Frak ships **two independent OpenPanel projects** because the two audiences and bundles must stay isolated:

| Project | OpenPanel client | Where it runs | Audience |
|---|---|---|---|
| **SDK** | `OPEN_PANEL_SDK_CLIENT_ID` | Partner websites (loaded by their dev team) | Merchants & their visitors |
| **Wallet** | `OPEN_PANEL_WALLET_CLIENT_ID` | wallet.frak.id + listener.frak.id (our domains) | Frak users |

The two are joined in dashboards via the **`sdk_anonymous_id`** property — the SDK stamps it on every event, and the wallet picks it up when the user lands on `wallet.frak.id` from a partner site (URL params, install referrer, install code, in-app browser escape, etc.). Without that join key, the funnels in §5 can't be reconstructed.

### Conventions
- All event names are `snake_case` and follow `domain_entity_action_outcome`.
- "Flows" emit a 4-event pattern (`_started` / `_succeeded` / `_failed` / `_abandoned`) sharing a `flow_id`.
- We never log raw amounts, raw recipient addresses, or merchant PII — bucketed values and hashed `merchant_id` only.

### Global context attached automatically to every event

Auto-attached on every wallet/listener event: `wallet`, `isIframe`, `isPwa`, `isTauri`, `platform`, `iframeReferrer`, `productId`, `contextUrl`, `session_id`, `app_version`, `sdk_anonymous_id`.

Auto-attached on every SDK event: `sdkVersion`, `userAnonymousClientId`, `merchantId`, `domain`.

Profile-level (set once on identify, not per-event): `install_source`, `sessionType`.

---

## Map of trackable surfaces

```
┌──────────────────────────────────────────────────────────────┐
│  PARTNER SITE  (e.g. shop.example.com)                       │
│  └── Frak SDK bundle                          → §1 SDK       │
│      ├── sdk_initialized / sdk_iframe_*       (init health)  │
│      ├── share_button_clicked                 (CTAs)         │
│      ├── banner_impression / _resolved        (CTAs)         │
│      ├── post_purchase_impression / _clicked  (CTAs)         │
│      ├── open_in_app_clicked / app_not_installed             │
│      └── user_referred_started / _completed   (referrals)    │
└──────────────────────────────────────────────────────────────┘
                       │ (sdk_anonymous_id)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  LISTENER  (listener.frak.id, in iframe on partner site)     │
│  ├── modal_*                                  → §2 Listener  │
│  ├── listener_tx_*                                            │
│  ├── embedded_wallet_opened / _closed                         │
│  ├── sharing_page_opened (overlay trigger)                    │
│  ├── sso_initiated / _completed / _failed                     │
│  └── in_app_browser_redirected / sdk_cleaned_up               │
└──────────────────────────────────────────────────────────────┘
                       │ (sdk_anonymous_id)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  WALLET  (wallet.frak.id + Tauri mobile)                     │
│  ├── auth_login_* / auth_register_* / auth_demo_*  → §3      │
│  ├── onboarding_*                                             │
│  ├── notification_opt_in_*                                    │
│  ├── pairing_request_*                                        │
│  ├── install_*  +  identity_ensure_*                          │
│  ├── sharing_page_viewed / sharing_link_*                     │
│  ├── wallet_modal_opened / _closed                            │
│  └── tokens_send_*                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## §1 — SDK events (partner sites)

These events fire from the merchant's own page. They tell us **whether the SDK loaded correctly, which Frak components are visible to visitors, and how those visitors interact**.

### 1.1 SDK lifecycle health

| Event | Fires when… | Properties |
|---|---|---|
| `sdk_initialized` | A `FrakClient` is instantiated on the partner page. | `sdkVersion?` |
| `sdk_iframe_connected` | The wallet iframe completed its handshake. | `handshake_duration_ms` |
| `sdk_iframe_handshake_failed` | The handshake never completed. | `reason: "timeout" \| "origin" \| "asset_push" \| "unknown"` |
| `sdk_init_failed` | The CDN bootstrap (`initFrakSdk`) threw before a client existed. | `reason`, `config_missing?` |

> `asset_push` specifically means "handshake worked, but the CSS/i18n injection broke" — visually broken integration, even though the SDK looks alive.

### 1.2 Share button

| Event | Fires when… | Properties |
|---|---|---|
| `share_button_clicked` | A `<frak-button-share>` is clicked. | `placement?`, `target_interaction?`, `has_reward?`, `click_action: "share-modal" \| "embedded-wallet" \| "sharing-page"` |
| `share_modal_error` | The modal failed to open after a click. | `placement?`, `target_interaction?`, `has_reward?`, `error?` |

> `click_action` is the destination resolved by the merchant's configuration — comparing per-configuration performance is the killer use case here.
>
> The floating `<frak-button-wallet>` is intentionally **not** instrumented (not used in production).

### 1.3 Banner

| Event | Fires when… | Properties |
|---|---|---|
| `banner_impression` | A `<frak-banner>` first becomes visible (deduped per page+variant). | `placement?`, `variant: "referral" \| "inapp"`, `has_reward?` |
| `banner_resolved` | The banner is closed — either clicked or dismissed. | `placement?`, `variant`, `outcome: "clicked" \| "dismissed"` |

### 1.4 Post-purchase card

| Event | Fires when… | Properties |
|---|---|---|
| `post_purchase_impression` | The post-purchase card renders. | `placement?`, `variant: "referrer" \| "referee"`, `has_reward?` |
| `post_purchase_clicked` | User clicks the card's CTA. | `placement?`, `variant` |

> `variant` is decisive: `referrer` = upselling a fresh share; `referee` = celebrating a successful incoming referral.

### 1.5 Open-in-app

| Event | Fires when… | Properties |
|---|---|---|
| `open_in_app_clicked` | A `<frak-open-in-app>` button is clicked. | `placement?`, `path` |
| `app_not_installed` | The deep-link didn't get answered within 2.5s. | `placement?`, `path` |

> Implicit "user needs to install" signal — paired with §5 to compute mobile retrieval funnels.

### 1.6 Referral detection (SDK side)

| Event | Fires when… | Properties |
|---|---|---|
| `user_referred_started` | The SDK detected a referral context (URL param, stored). | `referrer?`, `referrerClientId?`, `referrerWallet?`, `walletStatus?` |
| `user_referred_completed` | Backend processed the referral successfully. | `status: "success"` |

> `referrer` = legacy V1 wallet field; `referrerWallet` = V2 authenticated-sharer wallet (more reliable when present).

---

## §2 — Listener events (iframe overlay on partner sites)

The listener is the iframe Frak injects on partner sites. It owns the modals, the embedded wallet, and the shared SDK→Wallet bridge. Events here tell us **whether the bridge converted intent into action**.

### 2.1 Legacy modal (business-app driven)

| Event | Fires when… | Properties |
|---|---|---|
| `modal_opened` | The SDK requests a modal display. | `productId?`, `steps`, `entry_step` |
| `modal_step_viewed` | A step in the modal becomes visible. | `productId?`, `step`, `index`, `total` |
| `modal_step_error` | A real failure occurred inside a step (user-aborts excluded). | `productId?`, `step`, `reason`, `recoverable` |
| `modal_dismissed` | Modal closed. | `productId?`, `last_step?`, `completed`, `source: "backdrop" \| "close_btn" \| "escape" \| "final_action"` |

> `source: "final_action"` is organic completion. Anything else is a user exit.

### 2.2 Listener transaction flow (legacy)

| Event | Fires when… | Properties |
|---|---|---|
| `listener_tx_started` | Tx modal mounts. | `tx_count`, `is_mobile_pairing` |
| `listener_tx_succeeded` | Tx submitted successfully. | `tx_count`, `hash` |
| `listener_tx_failed` | Tx threw. | `tx_count`, `error_type`, `error_message` |
| `listener_tx_abandoned` | Modal unmounted before terminal state (kept for type-safety, not dashboarded). | — |
| `listener_tx_mobile_app_not_found` | Deep-link to the mobile wallet didn't resolve. | — |

### 2.3 Embedded wallet (deprecating)

| Event | Fires when… | Properties |
|---|---|---|
| `embedded_wallet_opened` | SDK requested the embedded wallet view. | `productId?`, `logged_in` |
| `embedded_wallet_closed` | User closed the view. | `productId?`, `duration_ms`, `logged_in_at_close` |

### 2.4 Sharing entry from partner site

| Event | Fires when… | Properties |
|---|---|---|
| `sharing_page_opened` | SDK called `frak_displaySharingPage` (overlay trigger). | `merchant_id?` |
| `sharing_link_copied` (legacy modal context) | User copied a link from inside the modal. | `source: "modal"`, `merchant_id?`, `link?` |
| `sharing_link_copied` (embedded wallet context) | User copied a link from the embedded wallet. | `source: "embedded_wallet"`, `merchant_id?`, `link?` |

### 2.5 SSO (listener-hosted button)

| Event | Fires when… | Properties |
|---|---|---|
| `sso_initiated` | User clicks an SSO entry button. | `method: "popup" \| "link" \| "mobile"` |
| `sso_completed` | SSO callback fired success. | — |
| `sso_failed` | SSO threw / popup blocked / pairing timeout. | `reason` |

### 2.6 In-app browser escape

| Event | Fires when… | Properties |
|---|---|---|
| `in_app_browser_redirected` | User hit the toast that escapes Instagram/Facebook webviews. | `target: "sd-iframe" \| "sd-iframe-clipboard" \| "window"` |

> The post-escape merge is captured by `identity_ensure_*{source:"inapp_redirect"}` (see §5).

### 2.7 Identity merge (cross-cutting)

| Event | Fires when… | Properties |
|---|---|---|
| `identity_ensure_executed` | Listener received a merge token (any of 5 sources). | `source: "url_params" \| "install_referrer" \| "install_code" \| "inapp_redirect" \| "stored"` |
| `identity_ensure_succeeded` | Backend merged the anon → wallet identity. | `source`, `duration_ms` |
| `identity_ensure_failed` | Merge errored. | `source`, `error_type` |

### 2.8 SDK cleanup

| Event | Fires when… | Properties |
|---|---|---|
| `sdk_cleaned_up` | SDK was destroyed (partner page navigation). | — |

---

## §3 — Wallet events: Authentication

### 3.1 Login / Register / Demo (4-event flows)

Each emits `_started` / `_succeeded` / `_failed` / `_abandoned`, sharing a `flow_id`.

| Flow | Extras | Notes |
|---|---|---|
| `auth_register` | — | Passkey creation. |
| `auth_login` | `method: "global" \| "specific"` | `global` = "sign in with any passkey", `specific` = "use authenticator X". |
| `auth_demo` | — | Demo mode CTA — sanity-check only. |

### 3.2 Standalone auth events

| Event | Fires when… | Properties |
|---|---|---|
| `auth_login_method_selected` | Pre-flow: user picks a login method on the screen. | `method: "passkey" \| "qr" \| "register_redirect"`, `origin?: "existing" \| "another"` |
| `auth_recovery_code_clicked` | User clicks the recovery-code link from the login screen. | — |
| `user_logged_in` | Profile is identified post-auth. | — (anchor event for cohort analysis) |
| `logout` | User clicks Logout. | — |

### 3.3 Pairing

| Event | Fires when… | Properties |
|---|---|---|
| `pairing_initiated` | User starts a pairing flow (QR display). | — |
| `pairing_completed` | Other-tab approval succeeded. | — |
| `pairing_request_viewed` | Wallet opens the approval route. | `has_id`, `mode: "qr" \| "code" \| "deep_link"` |
| `pairing_request_no_id` | Edge-case: route hit without an id. | — |
| `pairing_request_error` | Approval errored. | `error_state: "not_found" \| "transient"`, `mode?` |
| `pairing_request_refreshed` | User retried. | `mode?` |
| `pairing_request_confirmed` | User approved. | `mode?`, `duration_ms` |
| `pairing_request_cancelled` | User declined. | `mode?`, `duration_ms` |

---

## §4 — Wallet events: Onboarding & Notifications

### 4.1 Onboarding flow (register slides)

Wraps the entire register page. `_started` on mount, `_abandoned` on unmount before reaching Welcome.

| Event | Fires when… | Properties |
|---|---|---|
| `onboarding_started` / `_succeeded` / `_failed` / `_abandoned` | Flow lifecycle. | `last_step?` on `_abandoned` (`"onboarding" \| "notification" \| "welcome"`) |
| `onboarding_slide_viewed` | A slide becomes visible. | `index`, `translation_key` |
| `onboarding_action_clicked` | User clicks a CTA. | `action: "start" \| "continue" \| "activate_secure_space" \| "login" \| "recovery_code"`, `slide_index?` |

> `translation_key` (not slide index) is the stable identifier — slides can be reordered without breaking dashboards.

### 4.2 Notification opt-in

| Event | Fires when… | Properties |
|---|---|---|
| `notification_opt_in_viewed` | User reached the notification step. | — (shares the `onboarding` flow_id) |
| `notification_opt_in_resolved` | The step terminated. | `outcome: "enabled" \| "skipped" \| "denied" \| "auto_skipped_granted" \| "auto_skipped_denied"`, `reason?` |

> One terminal event with an `outcome` enum — dashboards filter by outcome rather than joining 5 separate event streams.

---

## §5 — Wallet events: Mobile install attribution

The **biggest ongoing KPI investment**. Three mechanisms feed the same `identity_ensure_*` outcome (§2.7), and we want to know where each user came from.

### 5.1 `/install` web gateway

| Event | Fires when… | Properties |
|---|---|---|
| `install_page_viewed` | Web `/install` page mounts. | `merchant_id?`, `has_anonymous_id`, `view: "code" \| "processing"` |
| `install_processing_triggered` | Already-logged-in user hits the silent path. | `is_logged_in`, `has_ensure_action` |
| `install_code_displayed` | A magic code is generated and shown. | `merchant_id?` |
| `install_code_generation_failed` | Backend failed before showing a code. | `merchant_id?`, `error_type` |
| `install_code_copied` | User clicks the copy button. | `merchant_id?` |
| `install_store_clicked` | User clicks App Store / Play Store. | `merchant_id?`, `store: "app_store" \| "play_store"`, `has_referrer` |
| `install_page_dismissed` | User closed the page without clicking. | — |
| `install_pwa_initiated` | "Add to Home Screen" PWA path. | — |

### 5.2 Android Play Install Referrer (passive)

| Event | Fires when… | Properties |
|---|---|---|
| `install_referrer_checked` | Tauri queried the Play referrer. | — |
| `install_referrer_resolved` | A valid referrer payload was found. | `has_merchant` |
| `install_referrer_missing` | Referrer absent or unusable. | `reason: "empty" \| "missing_params"` |
| `install_referrer_failed` | Plugin / Play Services error. | `error_type` |

### 5.3 Magic install code (iOS + non-Chrome Android)

| Event | Fires when… | Properties |
|---|---|---|
| `install_code_page_viewed` | Mobile-app code-entry page mounts. | — |
| `install_code_submitted` | User typed a code + clicked validate. | — |
| `install_code_resolved` | Backend accepted the code. | `has_wallet`, `merchant_domain` |
| `install_code_resolve_failed` | Backend rejected (expired / unknown / claimed). | `error_code` |

> `identity_ensure_*` (§2.7) is the cross-cutting outcome layer — every successful attribution path lands there.

---

## §6 — Wallet events: Sharing

5 entry points, **all carrying a `source` property** so dashboards segment trivially:

| `source` value | Surface |
|---|---|
| `sharing_page_wallet` | wallet.frak.id `/sharing` route |
| `sharing_page_listener` | Listener overlay (`frak_displaySharingPage`) |
| `modal` | Legacy listener modal final step |
| `embedded_wallet` | Embedded wallet view |
| `explorer_detail` | Wallet explorer merchant card (native share only — no copy) |
| `welcome_card` | Welcome card |

| Event | Fires when… | Properties |
|---|---|---|
| `sharing_page_viewed` | Sharing page mounts (wallet + listener overlay). | `merchant_id?` |
| `sharing_page_opened` | Listener-only: SDK called `frak_displaySharingPage`. | `merchant_id?` |
| `sharing_link_shared` | Native share succeeded. | `source`, `merchant_id?`, `link?` |
| `sharing_link_copied` | Clipboard copy. | `source`, `merchant_id?`, `link?` |

---

## §7 — Wallet events: Tokens & in-app modals

### 7.1 Token transfer (minimal — Monerium is the preferred path)

| Event | Properties | Notes |
|---|---|---|
| `tokens_send_started` | `prefill_address?` | Denominator. |
| `tokens_send_succeeded` | `token_symbol?`, `amount_bucket?` | `amount_bucket` is `<1 \| 1-10 \| 10-100 \| >100` — never raw amounts. |
| `tokens_send_failed` | `token_symbol?`, `error_type?`, `error_message?` | Triage. |
| `tokens_send_abandoned` | — | Component-unmount auto-fire, not dashboarded. |

### 7.2 Wallet in-app modals (auto-tracked)

A single subscription on the wallet `modalStore` produces events for every `openModal`/`closeModal` — new modals are tracked automatically without per-component instrumentation.

| Event | Fires when… | Properties |
|---|---|---|
| `wallet_modal_opened` | Top-of-stack changes. | `modal: string`, `from_stack: boolean` |
| `wallet_modal_closed` | Top-of-stack drops. | `modal: string`, `duration_ms` |

> `from_stack: false` = explicit user intent. `from_stack: true` = back-navigation revealing an earlier modal. Filter to `false` for clean intent counts.

---

## §8 — Insights: what this data unlocks

This section is for product strategy — what concrete questions can we answer today, and what we should build dashboards around.

### 8.1 Strategic KPIs (cross-cutting)

| KPI | Computed from | Why it matters |
|---|---|---|
| **Acquisition channel split** | `identity_ensure_executed` grouped by `source` (`direct` vs `url_params` vs `install_referrer` vs `install_code` vs `inapp_redirect`) | The single most important top-of-funnel question: "where do users come from?" |
| **Mobile install funnel** | `install_page_viewed → install_store_clicked → identity_ensure_succeeded` | End-to-end web→app retrieval rate. Splittable per `merchant_id` and per platform. |
| **In-app browser escape success** | `identity_ensure_succeeded{source:"inapp_redirect"} / in_app_browser_redirected` | Validates the most painful UX in our product. Should be near-1 if escape works. |
| **Auth funnel health** | `auth_register_succeeded / auth_register_started`, `auth_login_failed{method}` distribution | Method-level drop-off, including silent passkey cancels. |
| **SDK integration health (per merchant)** | `sdk_iframe_handshake_failed / sdk_initialized` grouped by `referrerClientId` | Proactive partner support — broken integrations are visible the moment they break. |
| **Referral loop conversion** | `share_button_clicked → sharing_link_shared → user_referred_started → user_referred_completed` | The end-to-end revenue loop. |
| **Component CTRs** | `banner_resolved{outcome:"clicked"} / banner_impression`, `post_purchase_clicked / post_purchase_impression` | Per-variant + per-placement performance. |
| **Onboarding heat-map** | `onboarding_slide_viewed{index:n+1} / onboarding_slide_viewed{index:n}` | Pinpoint the slide that costs us the most users. |
| **Pairing acceptance** | `pairing_request_confirmed / pairing_request_viewed`, segmented by `mode` | Whether device-pairing UX is converting on the merchant onboarding path. |
| **Notification opt-in rate** | `notification_opt_in_resolved{outcome:"enabled"} / notification_opt_in_viewed` | Push reach — gates retention efforts. |
| **Modal completion** | `modal_dismissed{completed:true} / modal_opened` | Whether modals deliver on their stated step path. |
| **Time-in-modal** | `wallet_modal_closed.duration_ms` p50/p95 per `modal` | Hesitation / engagement signal per modal type. |

### 8.2 Drop-off forensics (we already capture, dashboards still TBD)

These are ready to dashboard once the product team prioritises them:

- **Pre-auth drop-off** by slide: `onboarding_slide_viewed{translation_key:X}` not followed by `auth_register_started` within session.
- **Passkey cancellation rate**: `auth_register_failed{error_type:"NotAllowedError"} / auth_register_started` — silent biometric cancels.
- **Magic-code funnel**: `install_code_displayed → install_code_copied → install_code_submitted → install_code_resolved`. Each step in `InstallEventMap` is independently tracked.
- **In-app browser dropoff**: sessions where `isIframe=true` and `iframeReferrer` matches Instagram/FB but no `in_app_browser_redirected` fires within 30s — users blocked silently.
- **SSO transport failure**: `sso_failed.reason` distribution, segmented by `sso_initiated.method`. Tells us which transport (popup vs link vs mobile) is least reliable.

### 8.3 Privacy posture

What we **never** log, by design:
- Raw token amounts (use `amount_bucket` instead)
- Raw recipient addresses (only own wallet via profile identify)
- Merchant PII (only hashed `merchant_id` / `productId`)
- User input fields (no form values, no message bodies)
- IP addresses beyond what OpenPanel infers itself

This makes the dataset GDPR-defensible for re-export to merchant dashboards (§9).

---

## §9 — Per-merchant data: surfacing OpenPanel insights to the business dashboard

This is the most actionable opportunity for the product team. **Every event already carries either `productId` (wallet/listener) or `merchantId` (SDK) or both** — we just don't surface this back to merchants today. The business dashboard at `apps/business/src/module/{dashboard,merchant}` has the perfect home for it.

### 9.1 What we *can* surface today (zero new instrumentation needed)

These metrics are all readily computable from existing events, filtered by `productId` / `merchantId` for a single merchant.

#### A. Acquisition dashboard (per merchant)

For each merchant in `apps/business/src/module/merchant/component/MerchantDetails`:

| Surface as | Computed from | Honest about |
|---|---|---|
| **Total visitors who saw a Frak component** | distinct `userAnonymousClientId` where any `banner_impression` / `share_button_clicked` / `post_purchase_impression` fired with this `merchantId` | Browser/device level — not "users". |
| **Component CTR breakdown** | `banner_resolved{outcome:"clicked"} / banner_impression`, etc., per merchant | Compare across merchants to spot configuration issues. |
| **Wallet conversion** | `(install_store_clicked + identity_ensure_executed{source!="direct"}) / install_page_viewed` filtered by `merchant_id` | Top-of-funnel-to-installed-wallet. |
| **Identity merge success per merchant** | `identity_ensure_succeeded / identity_ensure_executed` filtered by `merchant_id` | Merchant-side attribution health — matters if a merchant's domain config is broken. |

#### B. Engagement dashboard (per merchant)

| Surface as | Computed from |
|---|---|
| **Share button performance** | `share_button_clicked` count, broken down by `placement` and `click_action` |
| **Post-purchase card performance** | `post_purchase_clicked / post_purchase_impression` split by `variant` (`referrer` vs `referee`) |
| **Open-in-app health** | `app_not_installed / open_in_app_clicked` ratio (high = users hitting the install fallback often) |
| **Banner dismissal rate** | `banner_resolved{outcome:"dismissed"} / banner_impression` per `variant` |

#### C. Referral loop dashboard (per merchant)

| Surface as | Computed from |
|---|---|
| **Referrals initiated** | `user_referred_started` count |
| **Referrals completed** | `user_referred_completed` count |
| **Sharing CTR** | `(sharing_link_shared + sharing_link_copied) / sharing_page_viewed` filtered by `merchant_id` |
| **Sharing channel mix** | `sharing_link_shared` distribution across `source` values (which surface drives most shares for them) |
| **Native-share vs copy ratio** | per merchant, segmented by `source` |

#### D. Integration health dashboard (per merchant)

| Surface as | Computed from | Why it matters to merchants |
|---|---|---|
| **SDK init success rate** | `sdk_iframe_connected / sdk_initialized` per `referrerClientId` | Lets merchants self-diagnose broken installs. |
| **Handshake latency** | `sdk_iframe_connected.handshake_duration_ms` p50/p95 | If their visitors see a slow handshake, it's a CDN/network issue on their side. |
| **Handshake failure breakdown** | `sdk_iframe_handshake_failed.reason` distribution | Origin errors = misconfigured allowed domains; asset_push errors = broken theme integration. |
| **Modal completion per merchant** | `modal_dismissed{completed:true} / modal_opened` per `productId` | Whether their checkout/share flow is delivering. |

#### E. Funnel visualisations (per merchant) — the biggest product win

We can build a single canonical funnel per merchant with 4 steps:

```
Component impression  →  Component click  →  Wallet identified  →  Referral completed
(banner_impression /     (banner_resolved /   (identity_ensure_      (user_referred_
 post_purchase_imp /      share_button_       succeeded with this    completed)
 share_button placed)     clicked)            merchant_id)
```

This is the "merchant ROI" view — exactly the data merchants ask us for over email today.

### 9.2 What we *could* surface with **small** instrumentation upgrades

Each of these unlocks a noticeable dashboard win and costs an event or two:

| Idea | Cost | Unlock |
|---|---|---|
| **Add `merchant_id` to wallet `auth_*` events** when register/login is initiated from a merchant context | Add property to existing flow extras | Per-merchant signup conversion (today we only know "user logged in", not "user signed up because merchant X drove them") |
| **Track `wallet_dashboard_viewed` with the merchants the user has interacted with** | New event | "Active users for merchant X" metric — distinct from raw click counts |
| **Track wallet → merchant page navigation** (when user clicks merchant card from explorer) | New `explorer_merchant_clicked` event (already in plan §7a) | Outbound traffic merchants get from inside the wallet |
| **Tag `sharing_link_shared` with the destination platform** (when feasible from the Web Share API) | Optional property | Per-merchant + per-platform share matrix (Twitter/WhatsApp/SMS/etc.) |
| **Add `merchant_id` to `notification_opt_in_resolved`** when opt-in occurs in a merchant context | Add property | Merchant-attributable push reach |
| **Track in-app browser context per merchant** | Add `merchant_id` to `in_app_browser_redirected` | Reveals which merchants drive the most traffic from Instagram/FB and benefit most from the escape feature |

### 9.3 What we *can't* answer yet (would need new instrumentation)

These remain blind spots and should inform the next instrumentation phase if/when product prioritises them:

- **Time-on-merchant-page before component interaction** — would need a `merchant_page_viewed` SDK event with a duration on unmount.
- **Component visibility duration** (impressions are deduped per page, but we don't track how long the user actually saw it).
- **Cross-device journey reconstruction beyond wallet** (we can stitch SDK→wallet, but not partner-site-A→partner-site-B for the same user).
- **Reward redemption** (we track shares started/completed, not reward unlock events from the merchant side).
- **Merchant dashboard usage itself** (the business app at `apps/business/` is currently uninstrumented — a separate plan).

### 9.4 Recommended rollout for the merchant dashboard

A phased plan that yields visible product wins fast:

1. **Phase A (no new events)** — surface §9.1 A + B + D in the existing `MerchantDetails` view. ~1-2 sprints of dashboard work.
2. **Phase B (minor instrumentation)** — pick the 2-3 highest-value upgrades from §9.2 and ship as part of one PR per area.
3. **Phase C (referral funnel)** — build the §9.1 E funnel visualisation as the centrepiece of `MerchantDetails`. Single most impactful merchant-facing number.
4. **Phase D (export-friendly)** — once C is live, expose the same numbers via a backend route so merchants can pull into their own BI tools.

---

## Appendix — files referenced

Wallet/listener event definitions (single source of truth for property shapes):
- `packages/wallet-shared/src/common/analytics/events/auth.ts`
- `packages/wallet-shared/src/common/analytics/events/install.ts`
- `packages/wallet-shared/src/common/analytics/events/onboarding.ts`
- `packages/wallet-shared/src/common/analytics/events/notification.ts`
- `packages/wallet-shared/src/common/analytics/events/pairing.ts`
- `packages/wallet-shared/src/common/analytics/events/modal.ts`
- `packages/wallet-shared/src/common/analytics/events/sharing.ts`
- `packages/wallet-shared/src/common/analytics/events/tokens.ts`
- `packages/wallet-shared/src/common/analytics/events/transaction.ts`
- `packages/wallet-shared/src/common/analytics/events/embeddedWallet.ts`
- `packages/wallet-shared/src/common/analytics/events/listener.ts`
- `packages/wallet-shared/src/common/analytics/events/flow.ts`

SDK event definitions:
- `sdk/core/src/utils/analytics/events/lifecycle.ts`
- `sdk/core/src/utils/analytics/events/component.ts`
- `sdk/core/src/utils/analytics/events/referral.ts`

Existing engineering reference & implementation plan:
- `docs/openpanel-events.md` — canonical event reference
- `docs/openpanel-tagging-plan.md` — implementation strategy
