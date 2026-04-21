# OpenPanel Tagging Plan — `apps/wallet`

## Context

The wallet app uses OpenPanel for analytics, wired up through `packages/wallet-shared/src/common/analytics/`. Today the instrumentation is focused almost exclusively on authentication and pairing flows, leaving the rest of the app (token send, onboarding steps, recovery, settings, explorer, history) largely invisible.

This plan defines a standard event taxonomy, the architectural split between `wallet-shared` / apps / SDK, the full event set required to reach meaningful KPI and drop-off coverage, and a phased rollout.

---

## 1. Principles

1. **Consistent naming** — `domain_entity_action_outcome` (snake_case, underscores only), matching the existing `register_initiated` / `login_completed` / `user_logged_in` convention already in the codebase.
2. **Typed call sites** — event names are typed via a single merged `EventMap` consumed by `trackEvent<K extends keyof EventMap>(name, props)`, so autocomplete + rename-symbol work and typos are caught at compile time.
3. **Funnel-first** — every `_initiated` event has matching `_succeeded` and `_failed` outcomes.
4. **Flow stitching via scoped instances** — multi-step flows use `startFlow(name)` which returns a scoped helper carrying a local `flow_id`. `flow_id` is **never** a global OpenPanel property (concurrent flows would collide).
5. **Backwards compatible** — existing `register_initiated` / `login_completed` / `pairing_initiated` / `user_logged_in` events stay as-is to preserve historical dashboards.
6. **Privacy first** — never attach raw amounts, raw addresses (other than own wallet for profile identify), or merchant PII. Hashed IDs and bucketed values only.

### Naming convention

```
domain_entity_action_outcome
```

| Segment | Examples |
|---|---|
| `domain` | `auth`, `onboarding`, `pairing`, `tokens`, `install`, `identity`, `settings`, `explorer`, `history`, `notification`, `sso`, `wallet`, `sharing`, `monerium`, `pending_action`, `modal`, `embedded_wallet` |
| `entity` | `register`, `login`, `flow`, `slide`, `request`, `send`, `step`, `biometrics`, `merchant`, `item`, `link`, `page`, `code`, `referrer`, `store`, `ensure` |
| `action` | `viewed`, `clicked`, `submitted`, `toggled`, `generated`, `uploaded`, `copied`, `dismissed` |
| `outcome` | `initiated`, `succeeded`, `failed`, `cancelled`, `skipped`, `abandoned` |

Not every event has all four segments — `wallet_dashboard_viewed` has three, `auth_register_failed` has four.

### Existing events (kept as-is)

| Event | Where |
|---|---|
| `register_initiated` / `register_completed` | `app/module/authentication/hook/useRegister.ts` |
| `login_initiated` / `login_completed` | `packages/wallet-shared/src/authentication/hook/useLogin.ts` |
| `demo_initiated` / `demo_completed` | `app/module/authentication/hook/useDemoLogin.ts` |
| `pairing_initiated` / `pairing_completed` | `packages/wallet-shared/src/pairing/*` |
| `sso_initiated` / `sso_completed` / `sso_failed` | listener side (kept) |
| `user_logged_in` | shared analytics (emitted on any auth success) |
| `logout` | `app/module/authentication/component/Logout/index.tsx` |

These names remain as aliases in the shared event map during the migration window.

### Existing events to migrate (kebab-case → snake_case)

OpenPanel dashboard aliases should map old → new for continuity:

| Old (kebab) | New (snake) | File |
|---|---|---|
| `install-pwa_initiated` | `install_pwa_initiated` | `app/module/wallet/component/InstallApp/index.tsx:68` |
| `sharing-share-link` | `sharing_link_shared` | `app/routes/sharing.tsx:243` + listener counterpart |
| `sharing-copy-link` | `sharing_link_copied` | `app/routes/sharing.tsx:260` + listener counterpart |
| `in-app-browser-redirect` | `in_app_browser_redirected` | `packages/wallet-shared/src/common/component/InAppBrowserToast` |
| `modal-dismissed` | `modal_dismissed` | `apps/listener/app/module/stores/modalStore.ts` |
| `open-embedded-wallet` | `embedded_wallet_opened` | `apps/listener/app/module/hooks/useDisplayEmbeddedWallet.ts` |
| `open-modal` | `modal_opened` | `apps/listener/app/module/hooks/useDisplayModalListener.ts` |
| `open-sharing-page` | `sharing_page_opened` | `apps/listener/app/module/hooks/useDisplaySharingPageListener.ts` |
| `sdk-cleanup` | `sdk_cleaned_up` | `apps/listener/app/module/hooks/useSdkCleanup.ts` |

---

## 2. Architecture

### 2a. Why a single merged event map

Early drafts of this plan proposed a factory (`createAppAnalytics<AppMap>()`) with per-app event maps and module-level singletons. We walked it back after honest cost/benefit review:

- Per-app scoping is theoretical — no wallet code path can emit listener-only events anyway (no modal code lives in wallet).
- 2 apps + single team doesn't justify the extra indirection (`analytics.track` vs a bare `trackEvent`).
- Generic type gymnastics (`<AppMap extends EventMap>`) with zero practical enforcement benefit.

A single merged `EventMap` + a plain `trackEvent<K extends keyof EventMap>(name, props)` function gives 95% of the typing benefit with zero ceremony. See `packages/wallet-shared/src/common/analytics/trackEvent.ts`.

### 2b. Package layout

```
packages/wallet-shared/src/common/analytics/
├── openpanel.ts        ← OpenPanel singleton + init
├── globalProps.ts      ← session_id, app_version, locale, has_biometrics, install_source
├── events/
│   ├── auth.ts         ← register_*, login_*, demo_*, sso_*, pairing_*, user_logged_in, logout
│   ├── sharing.ts      ← sharing_link_* (snake) + legacy kebab aliases
│   ├── flow.ts         ← flow_started / flow_succeeded / flow_failed / flow_abandoned / flow_cancelled
│   └── index.ts        ← merged EventMap = Auth & Sharing & Flow (extend as phases land)
├── trackEvent.ts       ← typed trackEvent<K extends keyof EventMap>(name, props)
├── startFlow.ts        ← scoped flow helper with double-end + track-after-end guards
└── index.ts            ← barrel (also re-exports legacy trackAuth* helpers)

sdk/core/src/utils/trackEvent.ts   ← UNTOUCHED (different OpenPanel client, CDN bundle, partner-site scope)
```

**Key principles:**
- One merged `EventMap` spans wallet + listener + shared domains. Listener-only events show up in wallet autocomplete; fine — no code path triggers them.
- New domain events (install_*, tokens_*, onboarding_*, modal_*, embedded_wallet_*, …) are added to `events/` as each Phase 2+ PR lands — either by extending an existing domain file or adding `events/<domain>.ts` and merging into `EventMap` in `events/index.ts`.
- The SDK stays isolated — different client (`OPEN_PANEL_SDK_CLIENT_ID` vs `OPEN_PANEL_WALLET_CLIENT_ID`), different bundle constraints (`noExternal: [/.*/]`), different audience (partner sites).

### 2c. API

```ts
// single events
import { trackEvent } from "@frak-labs/wallet-shared";

trackEvent("login_failed", { reason: "user_cancelled", method: "global" });
trackEvent("user_logged_in");
```

```ts
// multi-step flows
import { startFlow } from "@frak-labs/wallet-shared";

function useSend() {
    const handleSubmit = async () => {
        const flow = startFlow("tokens_send");
        flow.track("tokens_send_viewed", { token_symbol: "USDC" });

        try {
            await writeContractAsync({ /* ... */ });
            flow.end("succeeded"); // auto: duration_ms + flow_id
        } catch (err) {
            flow.end("failed", { error_type: classify(err) });
        }
    };
}
```

Module-level exports (not hooks) so Zustand stores and plain utilities can consume them.

---

## 3. Global Properties

Added via `setGlobalProperties` in `wallet-shared/analytics/globalProps.ts`:

| Property | Source | Purpose |
|---|---|---|
| `session_id` | `crypto.randomUUID()` persisted to `sessionStorage` (per tab) | stitch events from a single session |
| `app_version` | build-time Vite `define` | correlate regressions with releases |
| `locale` | `i18next` current language | segment KPIs per language |
| `has_biometrics` | biometric store (set lazily after first check, then cached) | segment by security posture |
| `install_source` | set by `useInstallReferrer` (Android Play), `useResolveInstallCode` (magic code), or `/install` query params; falls back to `"direct"` for organic installs | mobile-app attribution (`url_params` / `install_referrer` / `install_code` / `direct`) |

Already present: `wallet`, `isIframe`, `isPwa`, `isTauri`, `platform`, `iframeReferrer`, `productId`, `contextUrl`.

**Not a global:** `flow_id` — scoped to each flow instance (see §4).

### Standard per-event properties

- `duration_ms` — on `_succeeded` / `_failed` / `_cancelled` (elapsed since `_initiated`)
- `error_type` / `error_code` / `error_message` — on `_failed` (message truncated to 200 chars)
- `flow_id` — injected automatically by `startFlow` for flow-scoped events

---

## 4. Flow Tracking (Scoped Instances)

Multi-step flows use `startFlow(name)` which returns a scoped helper `{ flowId, flowName, ended, track, end }`. The `flow_id` is carried in closure — never stored in OpenPanel global props — so concurrent flows (e.g. token send + an embedded-wallet opened by push notification) never cross-contaminate.

### Two guards (cheap insurance)

- **Double-end guard** — second `flow.end(…)` call is a silent no-op. Prevents retry / double-submit logic from emitting twice.
- **Track-after-end guard** — `flow.track(…)` after `flow.end(…)` drops silently. Prevents late async callbacks (e.g. a `setTimeout` or a late `Promise.then` firing after the user already cancelled) from leaking events without flow context.

### Usage pattern

```ts
import { startFlow } from "@frak-labs/wallet-shared";

function useSend() {
    const handleSubmit = async () => {
        const flow = startFlow("tokens_send");
        flow.track("tokens_send_viewed", { token_symbol: "USDC" });

        flow.track("tokens_send_submitted", {
            token_symbol: "USDC",
            amount_bucket: "10-100",
        });

        try {
            await writeContractAsync({ /* ... */ });
            flow.end("succeeded"); // auto-injects duration_ms + flow_id
        } catch (err) {
            flow.end("failed", { error_type: classify(err) });
        }
    };
}
```

### Abandonment handling

Abandonment is tracked in two ways, deliberately lightweight:

1. **In-component** — flows that mount with the feature's root component should end themselves on unmount if not already ended:

```ts
useEffect(() => {
    const flow = startFlow("onboarding");
    flow.track("onboarding_flow_started");
    return () => {
        if (!flow.ended) flow.end("abandoned", { last_step: currentStepRef.current });
    };
}, []);
```

2. **OpenPanel funnel analysis for tab-close** — we intentionally do NOT register a global `beforeunload`/`pagehide` handler. These events are throttled/dropped by mobile Safari and fire unreliably on desktop too. Instead, we use OpenPanel's funnel reports to infer drop-off: users who fire `tokens_send_viewed` but not `tokens_send_succeeded` within N minutes are counted as drop-offs for funnel KPIs without needing a client-side abandonment event.

### Meta-events emitted by `startFlow`

| Event | When |
|---|---|
| `flow_started` | `startFlow(name)` — emits `{ flow_name, flow_id }` |
| `flow_succeeded` | `flow.end("succeeded")` — emits `{ flow_name, flow_id, duration_ms, ...extras }` |
| `flow_failed` | `flow.end("failed")` — emits `{ flow_name, flow_id, duration_ms, error_type, ... }` |
| `flow_abandoned` | `flow.end("abandoned")` — emits `{ flow_name, flow_id, duration_ms, last_step, ... }` |
| `flow_cancelled` | `flow.end("cancelled")` — user-initiated cancel |

These are defined in `wallet-shared/analytics/events/flow.ts` and are always available regardless of the app map.

---

## 5. P0 — Core Funnels

### 5a. Authentication funnel (register / login / demo)

**Owner:** `wallet-shared/analytics/events/auth.ts` (already scaffolded) — emitted from `wallet-shared/authentication/*` and wallet-side hooks.

**Gap:** `trackAuthFailed` helper exists but is never called. No method segmentation on login. No visibility into passkey cancellations — the single biggest silent drop-off.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `auth_register_failed` | `reason`, `error_type`, `flow_id` | catch block of `register()` | `app/module/authentication/hook/useRegister.ts` |
| `auth_login_failed` | `reason`, `error_type`, `method`, `flow_id` | catch block of `login()` | `packages/wallet-shared/src/authentication/hook/useLogin.ts` |
| `auth_demo_failed` | `reason`, `flow_id` | catch block | `app/module/authentication/hook/useDemoLogin.ts` |
| `auth_login_method_selected` | `method: "passkey" \| "qr"` | button click | `app/routes/_wallet/_auth/login.tsx:82` + `AuthActions` |
| `auth_recovery_code_clicked` | – | link in Onboarding | `app/routes/_wallet/_auth/register.tsx:114-116` |

Also pass `method` to existing `login_initiated` calls (field exists in `trackAuthInitiated` signature but not consistently used).

**KPIs unlocked:**
- Passkey success rate per method
- Top failure reasons (drill-down)
- Login method preference (passkey vs QR)

### 5b. Onboarding funnel (register flow)

**Owner:** `wallet-shared/analytics/events/onboarding.ts` (new in Phase 2, merged into the shared `EventMap`).

**Gap:** No step-level events. Cannot distinguish users who bounce at slide 1 vs slide 4.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `onboarding_flow_started` | – (flow_id injected) | Register route mount | `app/routes/_wallet/_auth/register.tsx:40` |
| `onboarding_slide_viewed` | `index`, `translation_key` | Slide becomes visible | `app/module/onboarding/component/Onboarding` + slides |
| `onboarding_action_clicked` | `action: "start" \| "continue" \| "activate_secure_space" \| "login" \| "recovery_code"`, `slide_index` | Onboarding CTAs | `register.tsx:107-122` |
| `onboarding_keypass_opened` | – | `handleOpenKeypass` | `register.tsx:90-100` |
| `onboarding_step_advanced` | `from`, `to` (`"onboarding" \| "notification" \| "welcome"`) | `setStep` transitions | `register.tsx:43,68,86,128` |
| `onboarding_flow_succeeded` | `duration_ms` | Welcome → continue | `register.tsx:136-142` |

All events tracked via `startFlow("onboarding")`.

**KPIs unlocked:**
- Slide-by-slide drop-off heatmap
- Impact of each slide on conversion
- Median time to complete onboarding

### 5c. Notification opt-in

**Owner:** `wallet-shared/analytics/events/notification.ts` (new in Phase 2).

**Gap:** Zero visibility on push reach.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `notification_opt_in_viewed` | – | NotificationOptIn mount | `app/module/onboarding/component/NotificationOptIn` |
| `notification_opt_in_enabled` | – | Enable button | `register.tsx:126-130` |
| `notification_opt_in_skipped` | – | Skip button | `register.tsx:131` |
| `notification_opt_in_denied` | `reason` | catch of `subscribeToPushAsync` | `register.tsx:129` |
| `notification_permission_resolved` | `permission: "granted" \| "denied" \| "default"` | `useNotificationStatus` resolution | `app/module/notification/hook/useNotificationSetupStatus` |
| `notification_auto_skipped` | `reason: "already_granted" \| "already_denied"` | auto-skip branch | `register.tsx:79-88` |

Tracked on the onboarding flow instance (shared `flow_id` with slides).

**KPIs unlocked:**
- Push opt-in rate per platform
- % users who hit auto-skip because of prior denial

### 5d. Pairing approval (protected route)

**Owner:** `wallet-shared/analytics/events/pairing.ts` (new in Phase 2 — `pairing_initiated`/`pairing_completed` already exist and stay).

**Gap:** `_protected/pairing.tsx` has zero events. Critical merchant-onboarding path.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `pairing_request_viewed` | `has_id`, `mode` | Page mount | `app/routes/_wallet/_protected/pairing.tsx:51` |
| `pairing_request_no_id` | – | No id branch | `pairing.tsx:86-98` |
| `pairing_request_error` | `error_state: "not_found" \| "transient"` | error branches | `pairing.tsx:101-140` |
| `pairing_request_refreshed` | – | refresh button | `pairing.tsx:129-136` |
| `pairing_request_confirmed` | `mode`, `duration_ms` | Confirm button | `pairing.tsx:173-175` |
| `pairing_request_cancelled` | `mode`, `duration_ms` | Cancel button | `pairing.tsx:166-168` |

**KPIs unlocked:**
- Pairing acceptance rate (`confirmed / viewed`)
- Time-to-confirm (hesitation signal)
- Error-to-abandon rate

### 5e. Token Send (core wallet utility)

**Owner:** `wallet-shared/analytics/events/tokens.ts` (new in Phase 2).

**Gap:** Entire flow is invisible — the biggest KPI gap given this is THE wallet feature.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `tokens_send_viewed` | `prefill_address: boolean` | Page mount | `app/routes/_wallet/_protected/tokens.send.tsx:176` |
| `tokens_send_token_changed` | `token_symbol` | `handleTokenChange` | `tokens.send.tsx:107` |
| `tokens_send_max_clicked` | `token_symbol` | `handleMaxClick` | `tokens.send.tsx:100` |
| `tokens_send_validation_failed` | `field: "address" \| "amount"`, `error_type` | form error render | `tokens.send.tsx:74-78, 145-149` |
| `tokens_send_biometric_requested` | – | `confirm()` call | `tokens.send.tsx:233` |
| `tokens_send_biometric_rejected` | – | `!confirmed` branch | `tokens.send.tsx:234` |
| `tokens_send_submitted` | `token_symbol`, `amount_bucket` | before `writeContractAsync` | `tokens.send.tsx:239` |
| `tokens_send_succeeded` | `token_symbol`, `duration_ms` | `isSuccess` effect | `tokens.send.tsx:210` |
| `tokens_send_failed` | `token_symbol`, `error_type`, `error_message`, `duration_ms` | catch block | `tokens.send.tsx:251-253` |

All tracked via `startFlow("tokens_send")`.

**Privacy:** never log `toAddress`, raw `amount`, or the user's `address`. Log only `token_symbol`, and optionally a bucketed `amount_bucket: "<1" \| "1-10" \| "10-100" \| ">100"` in token units if financial KPIs are desired.

**KPIs unlocked:**
- Send conversion: `submitted / viewed`
- Tx success rate: `succeeded / submitted`
- Biometric rejection rate (security friction)
- Median send duration

### 5f. Install Attribution (mobile app retrieval)

**Owner:** `wallet-shared/analytics/events/install.ts` (new in Phase 2).

**Gap:** Today we have zero visibility on the entire mobile app retrieval funnel — the biggest remaining KPI blind spot given the mobile-first push documented in `docs/mobile-onboarding-plan.md`. The `ensure` action that merges a user's anonymous web identity with their new mobile wallet is fired silently through three distinct mechanisms, and we cannot answer basic questions:

- What share of users who land on `/install` end up installing?
- What share of mobile installs successfully attribute back to a referring merchant (vs. organic)?
- Which attribution mechanism wins: Android Play Install Referrer, magic install code, or direct URL params?
- Where does the magic code funnel drop off (display → copy → resolve)?

Three entry points feed the same post-auth `pendingActionsStore` ensure action; this section instruments all three plus the backend outcome.

#### Install page — `wallet.frak.id/install` (web → app download)

The `/install` route is the web-side gateway. It renders two variants depending on platform + session state (see decision matrix in `apps/wallet/app/routes/install.tsx:41-63`).

| Event | Properties | Trigger | File |
|---|---|---|---|
| `install_page_viewed` | `merchant_id?`, `has_anonymous_id: boolean`, `view: "code" \| "processing"` | Route mount (either variant) | `apps/wallet/app/routes/install.tsx:48` |
| `install_processing_started` | `is_logged_in: boolean`, `has_ensure_action: boolean` | `InstallProcessing` effect mount | `install.tsx:88-120` |
| `install_code_displayed` | `merchant_id?` | `data?.code` resolved from `useGenerateInstallCode` | `install.tsx:249` |
| `install_code_generation_failed` | `error_type`, `merchant_id?` | `useGenerateInstallCode` error | `install.tsx:243-247` |
| `install_code_copied` | `merchant_id?` | Copy button click | `install.tsx:195-200` |
| `install_store_clicked` | `store: "app_store" \| "play_store"`, `has_referrer: boolean`, `merchant_id?` | Download link click | `install.tsx:299-306` |
| `install_page_dismissed` | – | Close button / `window.close()` | `install.tsx:215-221` |

**Note:** `has_referrer` is `true` when the Play Store URL carries the `referrer=merchantId=...&anonymousId=...` query (Android only, requires both IDs present — see `install.tsx:187-193`).

#### Android Play Install Referrer (passive attribution, zero-friction)

Read once on first launch via Tauri plugin. Deterministic, Google-signed, 90-day window. This is the winning path for the ~37% Android user base.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `install_referrer_checked` | – | `useInstallReferrer` queryFn runs (Tauri + Android only) | `apps/wallet/app/module/onboarding/hook/useInstallReferrer.ts:25` |
| `install_referrer_resolved` | `has_merchant: boolean` | Valid `merchantId` + `anonymousId` parsed and merchant resolved (also calls `setInstallSource("install_referrer")`) | `useInstallReferrer.ts:42-47` |
| `install_referrer_missing` | `reason: "empty" \| "missing_params"` | Referrer absent or missing required params | `useInstallReferrer.ts:30` |
| `install_referrer_failed` | `error_type` | Tauri plugin error (e.g. Play Services unavailable) | `useInstallReferrer.ts` error branch |

#### Magic install code (user-entered fallback, iOS + non-Chrome Android)

The 6-char alphanumeric code displayed on `/install` is re-entered inside the mobile app via `RecoveryCodePage` (misleadingly named — the `recovery-code/` module actually hosts the install-code resolver, unrelated to the recovery system).

| Event | Properties | Trigger | File |
|---|---|---|---|
| `install_code_page_viewed` | – | `RecoveryCodePage` mount | `apps/wallet/app/module/recovery-code/component/RecoveryCodePage/index.tsx:16` |
| `install_code_submitted` | – | Validate button click | `RecoveryCodePage/index.tsx:39` |
| `install_code_resolved` | `has_wallet: boolean`, `merchant_domain` | Successful resolve (also calls `setInstallSource("install_code")`) | `RecoveryCodePage/index.tsx:43-48` |
| `install_code_resolve_failed` | `error_code` (e.g. `CODE_NOT_FOUND`) | Resolve error | `apps/wallet/app/module/recovery-code/hook/useResolveInstallCode.ts:32` |
| `install_code_success_modal_viewed` | `merchant_id?` | Modal open | `apps/wallet/app/module/recovery-code/component/RecoveryCodeSuccessModal` |

#### Ensure outcome (cross-cutting — all three mechanisms converge here)

All three attribution paths land in `pendingActionsStore` as an `ensure` action, drained by `executePendingActions`. Tagging the outcome lets us measure the actual attribution success rate independent of entry point.

| Event | Properties | Trigger | File |
|---|---|---|---|
| `identity_ensure_executed` | `source: "url_params" \| "install_referrer" \| "install_code" \| "stored"` | `executeEnsure` called | `apps/wallet/app/module/pending-actions/hook/useExecutePendingActions.ts:101-111` |
| `identity_ensure_succeeded` | `source`, `duration_ms` | `executeEnsure` resolved | same |
| `identity_ensure_failed` | `source`, `error_type` | `executeEnsure` rejected | same |

`source` mirrors the `install_source` global property (set once per session by whichever mechanism resolved first) but stays per-event so retries / multi-source sessions remain debuggable.

#### Tracking notes

- **No `flow_id`** on these events — attribution is distributed across devices (web browser → Store → mobile app) so a single-process closure can't span the gap. Stitching is done server-side via the shared `merchantId` + `anonymousId` tuple (or the install code).
- `/install` events fire on the **web wallet**; referrer + code + ensure events fire on the **Tauri mobile app**. Aggregate KPIs need to join across the two `platform` values.
- Set `install_source` via `setInstallSource(…)` at the first successful resolve in a session; leave unset (or `"direct"` after auth completes without any prior signal) for organic installs.

**KPIs unlocked:**
- `/install` page conversion — `install_store_clicked / install_page_viewed`
- Install code funnel — `install_code_displayed → install_code_copied → install_code_submitted → install_code_resolved`
- Android passive attribution rate — `install_referrer_resolved / install_referrer_checked`
- Overall attribution success rate — `identity_ensure_succeeded / identity_ensure_executed` segmented by `source`
- Mechanism share — `install_source` distribution across all authenticated users
- Time-to-install — median elapsed time between `install_page_viewed` (web session) and the first `identity_ensure_succeeded` for the same merchant pair
- Organic vs referred install ratio — share of `identity_ensure_executed` with `source = "direct"` vs attributed sources

---

## 6. P1 — Settings & Security

All P1 events live in `wallet-shared/analytics/events/<domain>.ts` files merged into the shared `EventMap` (one file per domain as phases land).

> **Recovery flows intentionally omitted.** The existing `recovery/` import flow (6-step) and `recovery-setup/` module (encrypted backup kit) are scheduled for a full rework and are out of scope for this tagging plan. The `recovery-code/` directory, despite its name, is instrumented under §5f (it's the magic install-code resolver, not part of the recovery system). Re-evaluate recovery instrumentation once the rework lands.

### 6a. Settings

| Event | Properties | Trigger | File |
|---|---|---|---|
| `settings_page_viewed` | – | ProfilePage mount | `app/module/settings/component/ProfilePage` |
| `settings_language_changed` | `from`, `to` | language select | `ProfilePreferencesCard` |
| `settings_notification_toggled` | `enabled: boolean` | toggle | `ProfilePreferencesCard` |
| `settings_biometrics_toggled` | `enabled: boolean`, `platform` | toggle | `app/module/biometrics/component/BiometricSettings` |
| `settings_biometric_lock_triggered` | `reason: "app_open" \| "background_return"` | `BiometricLock` mount | `BiometricLock` |
| `settings_biometric_lock_succeeded` | `reason` | lock success | `BiometricLock` |
| `settings_biometric_lock_failed` | `reason` | lock failure | `BiometricLock` |
| `settings_private_key_viewed` | – | PrivateKey reveal | `PrivateKey` |
| `settings_private_key_copied` | – | copy button | `PrivateKey` |
| `settings_recovery_navigated` | – | Recovery card click | `Recovery` |
| `settings_legal_link_clicked` | `link_name` | legal link click | `LegalLinks` |
| `settings_identity_copied` | `field: "address" \| "username"` | copy from IdentityCard | `ProfileIdentityCard` |

Existing `logout` event stays as-is.

### 6b. Notifications center

| Event | Properties | Trigger | File |
|---|---|---|---|
| `notifications_page_viewed` | `unread_count` | Page mount | `app/routes/_wallet/_protected/notifications.tsx` |
| `notifications_item_clicked` | `notification_type` | item click | notifications page |
| `notifications_cleared_all` | `count` | Clear all | `app/module/notification/component/RemoveAllNotification` |

---

## 7. P2 — Discovery & Engagement

All P2 events live in `wallet-shared/analytics/events/<domain>.ts` files merged into the shared `EventMap` (sharing already scaffolded).

### 7a. Explorer (merchant discovery)

| Event | Properties | Trigger | File |
|---|---|---|---|
| `explorer_page_viewed` | `merchant_count` | Page mount | `app/routes/_wallet/_protected/explorer.tsx` |
| `explorer_merchant_viewed` | `merchant_id` (hashed), `position` | IntersectionObserver on card | `app/module/explorer/component` |
| `explorer_merchant_clicked` | `merchant_id`, `position` | Card click | `app/module/explorer/component` |
| `explorer_search_performed` | `query_length`, `results_count` | if search exists | explorer hook |
| `explorer_empty_state_viewed` | – | empty state render | explorer component |

### 7b. History (rewards & past activity)

| Event | Properties | Trigger | File |
|---|---|---|---|
| `history_page_viewed` | `item_count` | Page mount | `app/routes/_wallet/_protected/history.tsx` |
| `history_empty_state_viewed` | – | empty state | `app/module/history/component` |
| `history_item_clicked` | `item_type`, `position` | item click | `app/module/history/component` |
| `history_item_expanded` | `item_type` | accordion/expand | `app/module/history/component` |

### 7c. Wallet dashboard (landing)

| Event | Properties | Trigger | File |
|---|---|---|---|
| `wallet_dashboard_viewed` | `has_balance: boolean`, `token_count` | `wallet.index.tsx` mount | `app/routes/_wallet/_protected/wallet.index.tsx` |
| `wallet_balance_refreshed` | `manual: boolean` | refetch trigger | `app/module/wallet` |
| `wallet_send_clicked` | `source: "dashboard" \| "token_row"` | Send CTA | wallet dashboard |
| `wallet_receive_clicked` | – | Receive CTA | wallet dashboard |
| `wallet_token_clicked` | `token_symbol` | token row click | wallet dashboard |
| `wallet_install_pwa_viewed` | `platform` | InstallApp prompt viewed | `app/module/wallet/component/InstallApp` |
| `wallet_install_pwa_dismissed` | – | dismiss | InstallApp |

Existing `install_pwa_initiated` (after kebab→snake migration) remains — fired on actual install trigger.

### 7d. SSO inside Wallet (`_sso.tsx`)

| Event | Properties | Trigger | File |
|---|---|---|---|
| `sso_flow_viewed` | `referrer_merchant` | `_sso/sso.tsx` mount | `app/routes/_wallet/_sso/sso.tsx` |
| `sso_flow_succeeded` | `duration_ms` | success path | `_sso/sso.tsx` |
| `sso_flow_failed` | `error_type` | error path | `_sso/sso.tsx` |
| `sso_flow_cancelled` | – | cancel path | `_sso/sso.tsx` |

Listener already fires `trackAuthCompleted("sso", …)` → `sso_completed`; these new events capture the wallet-side view.

### 7e. Pending actions (post-auth redirects)

| Event | Properties | Trigger | File |
|---|---|---|---|
| `pending_action_queued` | `action_type` | action added | `app/module/pending-actions/stores` |
| `pending_action_executed` | `action_type`, `navigated: boolean` | execute | `app/module/pending-actions/hook/useExecutePendingActions` |
| `pending_action_failed` | `action_type`, `error_type` | catch | same |
| `pending_action_skipped_navigation` | `action_type` | `skipNavigation:true` path | `register.tsx:67` |

### 7f. Monerium

| Event | Properties | Trigger | File |
|---|---|---|---|
| `monerium_connect_clicked` | – | connect CTA | `app/module/monerium/component` |
| `monerium_callback_received` | `success: boolean` | callback mount | `app/routes/_wallet/_protected/monerium.callback.tsx` |
| `monerium_callback_failed` | `error_type` | failure branch | same |

### 7g. Sharing (shared wallet + listener)

**Owner:** `wallet-shared/analytics/events/sharing.ts` (emitted from both apps).

Existing events migrate to snake_case (`sharing_link_shared`, `sharing_link_copied`). Add:

| Event | Properties | Trigger | File |
|---|---|---|---|
| `sharing_page_viewed` | `merchant_id` | Page mount | `app/routes/sharing.tsx` |
| `sharing_link_generated` | `merchant_id` | link generation | `sharing.tsx` |

---

## 8. Implementation Strategy

### Phase 1 — Scaffolding ✅ **delivered**

1. `packages/wallet-shared/src/common/analytics/` reshape:
   - `openpanel.ts` — OpenPanel singleton + init + `getPlatformInfo`
   - `globalProps.ts` — `setProfileId`, `updateGlobalProperties`, `initAnalytics`, `getOrCreateSessionId`, `setLocale`, `setBiometricsFlag`, `setInstallSource`
   - `events/{auth,sharing,flow}.ts` + `events/index.ts` merged into single `EventMap`
   - `trackEvent.ts` — typed `trackEvent<K extends keyof EventMap>(name, props)`
   - `startFlow.ts` — scoped helper `{ flowId, flowName, ended, track, end }` with double-end + track-after-end guards
   - `index.ts` — barrel + backward-compat helpers (`trackAuth*`, `trackGenericEvent`, `setProfileId`, `openPanel`) preserved
2. Added global props to `AnalyticsGlobalProperties`: `session_id`, `app_version`, `locale`, `has_biometrics`, `install_source`.
3. Unit tests: 12 tests on `startFlow` (creation, track-id injection, duration timing, outcome meta-events, double-end guard, track-after-end guard).
4. No callsites migrated yet — all existing ~50 consumers still use the legacy helpers via `@frak-labs/wallet-shared`.

### Phase 2 — P0 rollouts (one PR per domain)

- **PR 1:** Auth failure backfill (`register`, `login`, `demo` catch blocks) → unlocks failure KPIs immediately. Migrate callsites to `trackEvent(…)` / `trackAuthFailed(…)`.
- **PR 2:** Pairing protected route (biggest merchant-side win).
- **PR 3:** Tokens send funnel.
- **PR 4:** Onboarding slide-level + notification opt-in.

### Phase 3 — P1 (Settings & Security)

- **PR 5:** Install attribution (install page + Play referrer + install code + ensure outcome) — unlocks the mobile retrieval funnel documented in §5f.
- **PR 6:** Settings (preferences, biometrics, private key, notifications center).

### Phase 4 — P2 (Discovery & Engagement)

- **PR 7:** Explorer + History + Wallet dashboard.
- **PR 8:** SSO + Pending actions + Monerium + Sharing (incl. kebab→snake migration for both apps).

### Phase 5 — OpenPanel dashboards (non-code)

Build dashboards/funnels in OpenPanel matching the KPI section. Suggested:
- **Onboarding funnel:** `onboarding_flow_started` → each `onboarding_slide_viewed` → `register_completed`
- **Send funnel:** `tokens_send_viewed` → `tokens_send_submitted` → `tokens_send_succeeded`
- **Pairing funnel:** `pairing_request_viewed` → `pairing_request_confirmed`
- **Install funnel:** `install_page_viewed` → `install_store_clicked` → `identity_ensure_succeeded` (split by `source`)
- **Segmented by:** `platform`, `isIframe`, `isPwa`, `locale`, `productId`, `app_version`

---

## 9. KPIs Delivered

| KPI | Formula | Depends on |
|---|---|---|
| Register conversion rate | `register_completed / onboarding_flow_started` | P0 auth + onboarding |
| Register drop-off per slide | `1 - (onboarding_slide_viewed(n+1) / onboarding_slide_viewed(n))` | P0 onboarding |
| Passkey failure rate | `auth_register_failed / register_initiated` | P0 auth |
| Login failure rate (by method) | `auth_login_failed{method} / login_initiated{method}` | P0 auth |
| Push opt-in rate | `notification_opt_in_enabled / notification_opt_in_viewed` | P0 notification |
| Pairing acceptance rate | `pairing_request_confirmed / pairing_request_viewed` | P0 pairing |
| Send completion rate | `tokens_send_succeeded / tokens_send_viewed` | P0 send |
| Send tx success rate | `tokens_send_succeeded / tokens_send_submitted` | P0 send |
| Biometric friction | `tokens_send_biometric_rejected / tokens_send_biometric_requested` | P0 send |
| Flow abandonment rate (any) | `flow_abandoned / flow_started` grouped by `flow_name` | Phase 1 |
| Install attribution success rate | `identity_ensure_succeeded / identity_ensure_executed` segmented by `source` | P0 install |
| `/install` page conversion | `install_store_clicked / install_page_viewed` | P0 install |
| Install code funnel conversion | `install_code_resolved / install_code_displayed` | P0 install |
| Android passive attribution rate | `install_referrer_resolved / install_referrer_checked` | P0 install |
| Organic vs referred install ratio | `identity_ensure_executed` grouped by `source` (`direct` vs rest) | P0 install |
| Biometrics adoption | distinct users with `settings_biometrics_toggled({enabled:true})` | P1 settings |
| Explorer CTR | `explorer_merchant_clicked / explorer_merchant_viewed` | P2 explorer |
| MAU by merchant | distinct `wallet` grouped by `productId` over window | existing + explorer |
| Session depth | avg events per `session_id` | Phase 1 globals |

---

## 10. Watch-outs

1. **Non-React call sites** — Zustand store actions and plain utilities need to emit events. `trackEvent` and `startFlow` are plain module-level exports (not hooks), so they work anywhere.
2. **Flow abandonment visibility** — flows that live inside a component should end themselves in the effect cleanup. We intentionally skip a global `beforeunload` handler because mobile Safari and some desktop browsers throttle/drop these events; funnel drop-off is better inferred from OpenPanel funnel reports.
3. **Backward-compat events** — existing `{auth}_initiated/_completed` / `user_logged_in` / `logout` strings stay as-is (principle #5). The merged `EventMap` keeps these names during the migration window so dashboards remain valid.
4. **Don't share the OpenPanel instance across SDK and wallet-shared** — different client IDs (`OPEN_PANEL_SDK_CLIENT_ID` vs `OPEN_PANEL_WALLET_CLIENT_ID`), different bundle constraints (SDK uses `noExternal: [/.*/]`), different audience. `trackEvent` only knows about the wallet-shared instance; SDK events stay in `sdk/core/src/utils/trackEvent.ts`.
5. **Global props lifecycle** — `session_id` is generated at OpenPanel init (`crypto.randomUUID()` persisted to `sessionStorage` per tab). `has_biometrics` is async (platform check); set it lazily via `setBiometricsFlag` after the first check, then cache. `app_version` is compile-time (Vite `define`). `locale` re-sets via `setLocale` on i18next language change.
6. **Concurrent flows must not cross-contaminate** — `flow_id` lives in the `startFlow` closure, never in OpenPanel global props. If a user opens tokens-send and simultaneously receives an embedded-wallet push, both flows have distinct ids. This is also why we chose scoped closures over a global "current flow" singleton.
7. **Scope discipline** — `wallet-shared` is **wallet + listener ONLY** (per `packages/wallet-shared/AGENTS.md`). Event domains for both apps live in the same `events/` directory but must not introduce imports from business/backend/shopify.

---

## 11. Appendix — Quick-win first PR

Phase 1 is scaffolding only. The recommended first instrumentation PR:

- `trackAuthFailed` calls in `useRegister.ts`, `useLogin.ts`, `useDemoLogin.ts` catch blocks (the helper already exists — just call it).
- `pairing_request_{viewed|confirmed|cancelled|error}` in `_protected/pairing.tsx` via `trackEvent(…)`.
- `tokens_send_{viewed|submitted|succeeded|failed}` in `_protected/tokens.send.tsx` via `startFlow("tokens_send")`.

That single PR closes the auth-error blind spot, instruments the two most critical conversion funnels, and validates the `trackEvent` + `startFlow` pattern on real callsites before rolling out to every domain.
