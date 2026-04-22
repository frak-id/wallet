# OpenPanel Events Reference

Canonical list of every event emitted across the wallet monorepo, grouped by the KPI category it feeds. Use this as the spec when wiring dashboards in OpenPanel.

> **Scope:** wallet + listener apps (via `packages/wallet-shared/src/common/analytics/`) + SDK bundle (via `sdk/core/src/utils/analytics/`). The two OpenPanel clients are intentionally separate — partner-site SDK events and wallet-side events are joined in dashboards via `sdk_anonymous_id`, not the same instance.

---

## Conventions

- **Event names** are `snake_case`, domain-prefixed: `domain_entity_action_outcome`.
- **Flows** emit 4 events — `_started` / `_succeeded` / `_failed` / `_abandoned` — sharing a `flow_id` (closure-scoped, never global). Some flows keep `_abandoned` in the type map for compile-time safety even when the dashboard doesn't read it; those are flagged below as **(dead)**.
- **Privacy**: no raw amounts, no raw recipient addresses, no merchant PII. Amounts are bucketed; addresses are `merchant_id` hashes only.
- **Global props** (attached to every event): `wallet`, `isIframe`, `isPwa`, `isTauri`, `platform`, `iframeReferrer`, `productId`, `contextUrl`, `session_id`, `app_version`, `sdk_anonymous_id`.
- **Profile props** (attached once on `identify`, not per-event): `install_source`, `sessionType`.

---

## 1. Acquisition & Install Attribution

**Business question:** Where are users coming from, and are we successfully linking their pre-install merchant touchpoint to their post-install wallet session?

**KPIs unlocked:**
- `/install` page conversion — `install_store_clicked / install_page_viewed`
- Install code funnel — `install_code_displayed → install_code_copied → install_code_submitted → install_code_resolved`
- Android passive attribution rate — `install_referrer_resolved / install_referrer_checked`
- Attribution success per mechanism — `identity_ensure_succeeded / identity_ensure_executed` grouped by `source`
- Organic vs referred split — distribution of `source` on `identity_ensure_executed` (`direct` vs rest)
- Post-escape identity merge success (in-app browser KPI) — `identity_ensure_succeeded{source:"inapp_redirect"} / identity_ensure_executed{source:"inapp_redirect"}`

### `/install` page (web gateway)

| Event | Properties | Why |
|---|---|---|
| `install_page_viewed` | `merchant_id?`, `has_anonymous_id`, `view: "code" \| "processing"` | Top of the funnel. `view` distinguishes the two page variants so we don't mix their conversion rates. |
| `install_processing_triggered` | `is_logged_in`, `has_ensure_action` | Covers the zero-UI path (already logged in → silent ensure). `identity_ensure_*` owns the outcome. |
| `install_code_displayed` | `merchant_id?` | Reached once per successful code generation; numerator for the code funnel. |
| `install_code_generation_failed` | `merchant_id?`, `error_type` | Surfaces backend issues that kill the funnel before the user sees a code. |
| `install_code_copied` | `merchant_id?` | Proxy for "user actually tried to use the code" vs just viewing the page. |
| `install_store_clicked` | `merchant_id?`, `store: "app_store" \| "play_store"`, `has_referrer` | Primary conversion event for the page. `has_referrer` tells us if this click will benefit from Play Install Referrer. |
| `install_page_dismissed` | — | Early-exit signal; lets us tell "closed without clicking" apart from "clicked then closed". |
| `install_pwa_initiated` | — | PWA "Add to Home Screen" — separate funnel from the mobile-app retrieval. |

### Android Play Install Referrer (passive attribution)

| Event | Properties | Why |
|---|---|---|
| `install_referrer_checked` | — | Denominator. Tells us how many Android+Tauri launches we actually queried. |
| `install_referrer_resolved` | `has_merchant` | Numerator for passive-attribution success. `has_merchant` distinguishes "referrer present" from "referrer present AND merchant resolvable". |
| `install_referrer_missing` | `reason: "empty" \| "missing_params"` | Differentiates "organic Android install" from "install with broken referrer payload". |
| `install_referrer_failed` | `error_type` | Plugin / Play Services failures. Should stay very low. |

### Magic install code (iOS + non-Chrome Android fallback)

| Event | Properties | Why |
|---|---|---|
| `install_code_page_viewed` | — | Denominator for post-install code flow. |
| `install_code_submitted` | — | User typed a code + clicked validate. |
| `install_code_resolved` | `has_wallet`, `merchant_domain` | Success. `has_wallet` matters because a code can resolve either to a brand-new anon or to an existing wallet on another device. |
| `install_code_resolve_failed` | `error_code` | Backend rejection (expired, unknown, already claimed). |

### Ensure outcome (cross-cutting — all mechanisms converge here)

| Event | Properties | Why |
|---|---|---|
| `identity_ensure_executed` | `source: "url_params" \| "install_referrer" \| "install_code" \| "inapp_redirect" \| "stored"` | The only per-source denominator. Filtered dashboards live here. |
| `identity_ensure_succeeded` | `source`, `duration_ms` | Actual merge success — the thing we care about. `duration_ms` captures backend merge latency. |
| `identity_ensure_failed` | `source`, `error_type` | Drill-down on merge errors per attribution path. |

> **Note on `source` values:** `url_params` = `/install?m=&a=` direct query; `install_referrer` = Android Play passive; `install_code` = magic code typed in app; `inapp_redirect` = user escaped an in-app browser and SDK fmt-token triggered a merge; `stored` = persisted ensure action replayed on a later launch.

---

## 2. In-App Browser Escape (critical for Instagram/Facebook embedded webviews)

**Business question:** Our solution degrades inside in-app browsers. Do users actually escape, and do their identities merge successfully when they land in a real browser?

**KPIs unlocked:**
- In-app browser escape rate — `in_app_browser_redirected / (sessions where isInAppBrowser=true)`
- Target distribution — `in_app_browser_redirected` grouped by `target`
- Post-escape merge success — `identity_ensure_succeeded{source:"inapp_redirect"} / identity_ensure_executed{source:"inapp_redirect"}`

| Event | Properties | Why |
|---|---|---|
| `in_app_browser_redirected` | `target: "sd-iframe" \| "sd-iframe-clipboard" \| "window"` | Triggered from `InAppBrowserToast`. `target` distinguishes the three escape paths — iframe `x-safari-https://`, iPad clipboard fallback, and non-iframe `redirectToExternalBrowser`. |
| `identity_ensure_executed{source:"inapp_redirect"}` | (see §1) | Fired in the listener's `lifecycleHandler` when the SDK hands us an `fmt` merge token from the external browser. |
| `identity_ensure_succeeded{source:"inapp_redirect"}` | (see §1) | Actual merge success for a user who bounced out of an in-app browser. |
| `identity_ensure_failed{source:"inapp_redirect"}` | (see §1) | Merge failed despite the user escaping — these should be near-zero. |

---

## 3. Authentication (register / login / demo / SSO / pairing)

**Business question:** Are users making it through signup, login, and device pairing? Where do they drop off, and why?

**KPIs unlocked:**
- Register conversion — `auth_register_succeeded / auth_register_started`
- Login failure rate per method — `auth_login_failed{method} / auth_login_started{method}`
- Method preference — `auth_login_method_selected` distribution
- SSO success — `sso_completed / sso_initiated{method}`
- Pairing acceptance — `pairing_request_confirmed / pairing_request_viewed`

### Auth flows

All three auth flows emit the standard 4-event pattern (`_started / _succeeded / _failed / _abandoned`). `_abandoned` fires on component unmount before terminal outcome.

| Flow | Extras | Why |
|---|---|---|
| `auth_register` | — | Passkey creation flow. |
| `auth_login` | `method: "global" \| "specific"` | `method` separates "click any existing passkey" from "pick a specific authenticator" conversion. |
| `auth_demo` | — | Demo mode — exists mainly to sanity-check that the demo CTA still works. |

### Standalone auth events

| Event | Properties | Why |
|---|---|---|
| `auth_login_method_selected` | `method: "passkey" \| "qr"` | Pre-flow intent signal. Comparing selection distribution to flow outcome tells us if one method is underperforming despite being chosen. |
| `auth_recovery_code_clicked` | — | Entry to the alternative code-based recovery path from the login screen. |
| `user_logged_in` | — | Fired once the OpenPanel profile is identified; anchor event for session-depth and cohort analysis. |
| `logout` | — | Counts user-initiated logouts (not timeout / redirect). |
| `pairing_initiated` / `pairing_completed` | — | Device pairing — not wrapped in a flow because `_initiated` is emitted from `LaunchPairing` and `_completed` from the approval route in the other tab. |
| `sso_initiated` | `method: "popup" \| "link" \| "mobile"` | SSO entry; `method` captures which transport the SDK chose. |
| `sso_completed` / `sso_failed` | `reason?` | SSO outcome. Listener-side (we don't own the popup) so we rely on the success callback. |

### Pairing approval route (wallet-side)

| Event | Properties | Why |
|---|---|---|
| `pairing_request_viewed` | `has_id`, `mode` | Page mount. `has_id` and `mode` feed per-variant funnel splits. |
| `pairing_request_no_id` | — | Edge case: user hit the route without a pairing id (dev/broken deep link). |
| `pairing_request_error` | `error_state: "not_found" \| "transient"`, `mode?` | Distinguishes "pairing expired/unknown" from "transient network" for support triage. |
| `pairing_request_refreshed` | `mode?` | User retried — useful friction signal. |
| `pairing_request_confirmed` | `mode?`, `duration_ms` | Primary success. `duration_ms` captures hesitation. |
| `pairing_request_cancelled` | `mode?`, `duration_ms` | Explicit decline — not the same as abandoning via close. |

---

## 4. Onboarding (register flow slides)

**Business question:** Which onboarding slide causes drop-off? Do users click "login" instead (returning users)?

**KPIs unlocked:**
- Slide drop-off heatmap — `onboarding_slide_viewed{index:n} / onboarding_slide_viewed{index:n-1}`
- Onboarding completion rate — `onboarding_succeeded / onboarding_started`
- Action distribution — `onboarding_action_clicked` by `action`
- Median time to complete — `onboarding_succeeded.duration_ms`

Flow wraps the whole register page. `_started` fires on mount, `_abandoned` on unmount if the user never reached Welcome.

| Event | Properties | Why |
|---|---|---|
| `onboarding_started` / `_succeeded` / `_failed` / `_abandoned` | `last_step` on `_abandoned` | Funnel anchors. `last_step` narrows where the user bailed ("onboarding" / "notification" / "welcome"). |
| `onboarding_slide_viewed` | `index`, `translation_key` | Per-slide visibility. `translation_key` keeps the event stable even when slides are reordered. |
| `onboarding_action_clicked` | `action: "start" \| "continue" \| "activate_secure_space" \| "login" \| "recovery_code"`, `slide_index?` | The only CTA click we care about. Splitting "continue" vs "activate_secure_space" tells us passkey-creation intent separately from slide progression. |

---

## 5. Notification Opt-In

**Business question:** Are users granting push permissions? What's the drop-off vs auto-skip rate per platform?

**KPIs unlocked:**
- Opt-in rate — `notification_opt_in_resolved{outcome:"enabled"} / notification_opt_in_viewed`
- Auto-skip share — `notification_opt_in_resolved{outcome:"auto_skipped_*"} / notification_opt_in_viewed`
- Explicit denial rate — `notification_opt_in_resolved{outcome:"denied"}`

| Event | Properties | Why |
|---|---|---|
| `notification_opt_in_viewed` | — | User reached the notification step (shares `onboarding` flow_id). |
| `notification_opt_in_resolved` | `outcome: "enabled" \| "skipped" \| "denied" \| "auto_skipped_granted" \| "auto_skipped_denied"`, `reason?` | Single terminal event. `outcome` consolidates what was previously 5 separate events; dashboards filter by outcome. |

---

## 6. Merchant-Site Components (SDK bundle)

**Business question:** Are our partner-site components driving clicks? Which variant / placement performs?

**KPIs unlocked:**
- Share button CTR — `share_button_clicked / (page views on partner site)`
- Banner CTR — `banner_clicked / banner_impression` (per `variant`)
- Post-purchase CTR — `post_purchase_clicked / post_purchase_impression`
- Referral conversion — `user_referred_completed / user_referred_started`
- Open-in-app success — `open_in_app_clicked / (open_in_app_clicked + app_not_installed)`

### Buttons

| Event | Properties | Why |
|---|---|---|
| `share_button_clicked` | `placement?`, `target_interaction?`, `has_reward?`, `click_action: "share-modal" \| "embedded-wallet" \| "sharing-page"` | `click_action` captures which destination the merchant configuration resolved to. Lets us compare per-configuration performance. |
| `share_modal_error` | `placement?`, `target_interaction?`, `has_reward?`, `error?`, `debug_info?` | Error surfacing — low-volume, but important for partner support. |
| `share_error_debug_copied` | `placement?`, `target_interaction?`, `has_reward?` | User copied the debug payload → they're actively trying to report the error. Micro signal for support load. |
| `open_in_app_clicked` | `placement?`, `path` | Primary action event for `<frak-open-in-app>`. |
| `app_not_installed` | `placement?`, `path` | Deep-link fallback fired when the app doesn't answer within 2.5s. Implicit "user needs to install" signal. |

> **Floating `<frak-button-wallet>`**: not instrumented — not actively used in production. Re-add a click event if/when adoption resumes.

### Banner & Post-Purchase

| Event | Properties | Why |
|---|---|---|
| `banner_impression` | `placement?`, `variant: "referral" \| "inapp"`, `has_reward?` | Fired once per banner/variant/page, deduped in component state. CTR denominator. |
| `banner_clicked` | `placement?`, `variant` | CTR numerator. |
| `banner_dismissed` | `placement?`, `variant` | Explicit "not interested" signal. Distinguishes banner blindness from rejection. |
| `post_purchase_impression` | `placement?`, `variant: "referrer" \| "referee"`, `has_reward?` | Highest-intent entry into the referral loop. `variant` tells us whether we're upselling a new share or celebrating an existing referee. |
| `post_purchase_clicked` | `placement?`, `variant` | CTR numerator for the post-purchase card. |

### Referral tracking (SDK side)

| Event | Properties | Why |
|---|---|---|
| `user_referred_started` | `referrer?`, `referrerClientId?`, `walletStatus?` | Fires when the SDK detects a referral context. |
| `user_referred_completed` | `status: "success"` | Processed successfully. |

---

## 7. Sharing (unified across 5 entry points)

**Business question:** Does sharing convert? Which entry point performs best? Does native share vs copy split differently per surface?

**Entry points** (carried as `source` on every link event):
- `sharing_page_wallet` — wallet `/sharing` route (merchant-driven flow, full funnel)
- `sharing_page_listener` — listener `frak_displaySharingPage` handler (SDK-driven overlay)
- `modal` — listener legacy modal final sharing step (business app)
- `embedded_wallet` — listener embedded wallet view (deprecating)
- `explorer_detail` — wallet explorer merchant detail card (native share only, no copy)

**Shared infrastructure** (`packages/wallet-shared/src/sharing/`):
- `buildSharingLink()` — single helper for `FrakContextManager.update` + `mergeAttribution`; used by all 5 entry points.
- `useShareLink()` — single hook; auto-fires `sharing_link_shared` with `{source, merchant_id, link}` on success. Takes an optional `onShared` callback for the listener's backend `useTrackSharing` interaction.

**KPIs unlocked:**
- Sharing conversion per entry point — `(sharing_link_shared + sharing_link_copied) / sharing_page_viewed` grouped by `source`
- Share-vs-copy split — ratio per `source`
- Entry-point performance comparison — `sharing_link_shared` distribution across the 5 `source` values
- Listener overlay open rate — `sharing_page_opened` (partner-site trigger) paired with `sharing_page_viewed` (actual render)

| Event | Properties | Why |
|---|---|---|
| `sharing_page_viewed` | `merchant_id?` | Page mount. Fires on both sharing-page surfaces (`sharing_page_wallet` and `sharing_page_listener`). Not fired on modal/embedded/explorer surfaces — they're one-shot buttons, not dedicated pages. |
| `sharing_page_opened` | `merchant_id?` | Listener-only: the SDK called `frak_displaySharingPage` via RPC. Joinable with the paired `sharing_page_viewed` via `sdk_anonymous_id`. |
| `sharing_link_shared` | `source`, `merchant_id?`, `link?` | Native share succeeded. Auto-fired by `useShareLink` — consistent across all 5 entry points. |
| `sharing_link_copied` | `source`, `merchant_id?`, `link?` | Clipboard copy. Fired manually at each callsite (4 entry points — explorer has no copy button). |

> **`source` is required** on every link event so segmentation is trivial. Adding a new sharing surface requires extending the `SharingSource` union in `packages/wallet-shared/src/common/analytics/events/sharing.ts`, which makes the requirement visible at compile time.

---

## 8. Wallet In-App Modal Usage (auto-tracked)

**Business question:** Which in-wallet modals do users actually open? Where do they spend time? Mirrors OpenPanel's auto page tracking philosophy — zero per-modal instrumentation, fully automatic.

**How it works:** A single subscription on the wallet `modalStore` fires the events on every `openModal` / `closeModal` call. New modals added to the `ModalState` union get tracked automatically.

**KPIs unlocked:**
- Modal open distribution — `wallet_modal_opened` grouped by `modal`
- New-intent vs back-navigation split — `wallet_modal_opened{from_stack:false}` vs `{from_stack:true}`
- Time-in-modal — `wallet_modal_closed.duration_ms` p50/p95 per `modal`
- Modal-to-action correlation — join `wallet_modal_opened{modal:"keypass"}` with `auth_register_succeeded` for keypass conversion, etc.

| Event | Properties | Why |
|---|---|---|
| `wallet_modal_opened` | `modal: string`, `from_stack: boolean` | Fires on every `modalStore` transition that surfaces a new top-of-stack. `modal` is the discriminator id (`"transfer"`, `"keypass"`, `"recoveryCodeSuccess"`, etc.). |
| `wallet_modal_closed` | `modal: string`, `duration_ms` | Fires when a modal leaves top-of-stack (close or replaced by a new modal stacked on top). `duration_ms` is the time it was visible at top. |

> **`from_stack` semantics:** `false` = user explicitly opened a fresh modal ("new intent"). `true` = user closed a modal stacked on top, revealing this one again. Dashboards filter on `from_stack:false` for clean intent counts.

> **Why a single generic event vs per-modal events:** keeps maintenance to zero (new modals just work), and OpenPanel filters by property as easily as by event name. Trade-off: dashboards must know the `modal` id values — they're listed in `apps/wallet/app/module/stores/modalStore.ts` (`ModalState` union).

---

## 9. Legacy Modal (business app only — minimal coverage)

**Business question:** The legacy modal system only serves our own business app. We just need per-step visibility + error surfacing — no deep funnel analysis needed.

**KPIs unlocked:**
- Modal completion rate — `modal_dismissed{completed:true} / modal_opened`
- Per-step drop-off — inferred from `modal_step_viewed` transitions
- Step error rate — `modal_step_error` per `step`

| Event | Properties | Why |
|---|---|---|
| `modal_opened` | `productId?`, `steps`, `entry_step` | Denominator. `steps` lets us classify modal types. |
| `modal_step_viewed` | `productId?`, `step`, `index`, `total` | Fires on every step transition. Step N's "completion" is inferred from the subsequent `modal_step_viewed{index:N+1}`. |
| `modal_step_error` | `productId?`, `step`, `reason`, `recoverable` | Only emitted for real failures — `clientAborted` is filtered out (that's a user-initiated dismiss, not an error). |
| `modal_dismissed` | `productId?`, `last_step?`, `completed`, `source: "backdrop" \| "close_btn" \| "escape" \| "final_action"` | Terminal event. `source="final_action"` means organic completion; the rest are user exits. |

> **Intentionally not tracked:** `modal_step_completed` — inferable from the next `modal_step_viewed` or from `modal_dismissed.last_step`.

---

## 10. Legacy Transaction Modal (business app only — minimal coverage)

**Business question:** Minimal visibility on transaction-signing success, plus mobile app install health.

**KPIs unlocked:**
- Transaction success rate — `listener_tx_succeeded / listener_tx_started`
- Mobile app availability — `listener_tx_mobile_app_not_found / listener_tx_started{is_mobile_pairing:true}`

Flow emits the standard 4 events (`_started / _succeeded / _failed / _abandoned`). `_abandoned` is retained as a dead event name to keep `startFlow` type-safe.

| Event | Properties | Why |
|---|---|---|
| `listener_tx_started` | `tx_count`, `is_mobile_pairing` | Denominator. `is_mobile_pairing` separates desktop-WebAuthn flow from mobile deep-link flow. |
| `listener_tx_succeeded` | `tx_count`, `hash` | Success. `hash` helps cross-reference with on-chain events if needed. |
| `listener_tx_failed` | `tx_count`, `error_type`, `error_message` | Error for triage. |
| `listener_tx_abandoned` | — **(dead)** | Emitted automatically on component unmount; not dashboarded. |
| `listener_tx_mobile_app_not_found` | — | Deep-link fallback fired when the mobile wallet app doesn't answer. Critical signal for mobile-app install health. |

---

## 11. Embedded Wallet (listener — will be deprecated)

**Business question:** Minimal engagement signal before this flow is retired in favor of the sharing page.

**KPIs unlocked:**
- Embedded open rate — `embedded_wallet_opened` per partner (segment by `productId`)
- Median session length — `embedded_wallet_closed.duration_ms`

| Event | Properties | Why |
|---|---|---|
| `embedded_wallet_opened` | `productId?`, `logged_in` | Entry. `logged_in` tells us whether it opens an authenticated or signup state. |
| `embedded_wallet_closed` | `productId?`, `duration_ms`, `logged_in_at_close` | Exit. `logged_in_at_close` captures whether the user authenticated during the session. |

---

## 12. Token Transfer (minimal — Monerium is the preferred flow)

**Business question:** Just a basic success-rate sanity check on the regular ERC-20 transfer flow.

**KPIs unlocked:**
- Transaction success rate — `tokens_send_succeeded / tokens_send_started`

Flow emits the standard 4 events; `_abandoned` is retained as a dead event name.

| Event | Properties | Why |
|---|---|---|
| `tokens_send_started` | `prefill_address?` | Denominator. `prefill_address` distinguishes "user clicked a deep-link send link" from "user navigated manually". |
| `tokens_send_succeeded` | `token_symbol?`, `amount_bucket?` | Success with coarse segmentation. `amount_bucket` is `"<1"/"1-10"/"10-100"/">100"` — never raw amounts. |
| `tokens_send_failed` | `token_symbol?`, `error_type?`, `error_message?` | Error for triage. |
| `tokens_send_abandoned` | — **(dead)** | Emitted on unmount; not dashboarded. |

---

## 13. SDK Health (partner-site bundle)

**Business question:** Is the SDK initializing correctly on partner sites? Can we detect broken integrations proactively?

**KPIs unlocked:**
- Init success rate — `sdk_iframe_connected / sdk_initialized`
- Handshake failure distribution — `sdk_iframe_handshake_failed` by `reason`
- Bootstrap failure rate — `sdk_init_failed` absolute count per partner (`referrerClientId`)
- Handshake latency — `sdk_iframe_connected.handshake_duration_ms` (p50/p95)

| Event | Properties | Why |
|---|---|---|
| `sdk_initialized` | `sdkVersion?` | Fires once on client instantiation. Denominator for all SDK health KPIs. |
| `sdk_iframe_connected` | `handshake_duration_ms` | Success. Latency distribution segments by partner / browser / platform. |
| `sdk_iframe_handshake_failed` | `reason: "timeout" \| "origin" \| "asset_push" \| "unknown"` | Distinguishes network timeouts from origin-validation failures from CSS/i18n push errors. `asset_push` specifically means "handshake ok, but CSS/i18n injection broke" — visually broken integration. |
| `sdk_init_failed` | `reason`, `config_missing?` | CDN bootstrap failure before a client exists. Fires on a transient OpenPanel instance so we still capture the error. |
| `sdk_cleaned_up` | — | Listener-side: SDK was torn down (partner page navigation). Low-volume lifecycle signal. |

---

## Event Domain Index

| Domain | File | Event count | Purpose |
|---|---|---|---|
| Auth | `events/auth.ts` | 9 (+3×4 flow) | Login/register/demo/SSO/pairing |
| Install | `events/install.ts` | 19 | /install page + Play referrer + magic code + `identity_ensure_*` |
| Onboarding | `events/onboarding.ts` | 2 (+1×4 flow) | Register-flow slides |
| Notification | `events/notification.ts` | 2 | Push opt-in |
| Pairing | `events/pairing.ts` | 6 | Wallet-side pairing approval route |
| Modal (listener) | `events/modal.ts` | 4 | Legacy listener modal |
| Modal (wallet) | `events/modal.ts` | 2 | Auto-tracked wallet in-app modals |
| Transaction | `events/transaction.ts` | 1 (+1×4 flow) | Legacy listener tx flow |
| Tokens | `events/tokens.ts` | 0 (+1×4 flow) | Wallet token send |
| Sharing | `events/sharing.ts` | 5 | Sharing page + link distribution |
| Embedded wallet | `events/embeddedWallet.ts` | 2 | Listener embedded wallet |
| Listener misc | `events/listener.ts` | 2 | InApp browser escape + SDK cleanup |
| SDK lifecycle | `sdk/core/.../lifecycle.ts` | 4 | SDK init + handshake |
| SDK components | `sdk/core/.../component.ts` | 10 | Merchant-site buttons/banners |
| SDK referral | `sdk/core/.../referral.ts` | 2 | Referral detection & completion |

**Flow events** (started + succeeded + failed + abandoned) per `FlowEvents<T>` helper: `auth_login`, `auth_register`, `auth_demo`, `onboarding`, `tokens_send`, `listener_tx`.

---

## Coverage Audit vs Business Priorities

| Business area | Priority | Coverage |
|---|---|---|
| Sharing page (wallet + listener) | High | Full (§7) |
| Share button, post-purchase, banner components | High | Full (§6) |
| Floating wallet button | Not used | **Intentionally not tracked** |
| SSO / login / register | High | Full (§3) |
| Legacy modal (business app only) | Low | Minimal — step-level + errors only (§9, §10) |
| Embedded wallet (listener, deprecating) | Minimal | Open/close only (§11) |
| Onboarding flow | High | Slide-level + action clicks (§4) |
| Notification opt-in / push reach | High | Viewed + resolved with outcome (§5) |
| Install rate / merchantId retrieval | High | Full 3-mechanism funnel + ensure outcome (§1) |
| In-app browser escape | High | Redirect event + `identity_ensure_{source:"inapp_redirect"}` (§2) |
| User actions on merchant sites | High | Components (§6) + Sharing (§7) |
| App usage (pages, modals) | Medium | OpenPanel auto page tracking + `modal_opened` / `modal_step_viewed` (§9) + auto `wallet_modal_*` (§8) |
| Token transfer | Low | 3-outcome flow only (§12) |
| SDK init / handshake health | Nice-to-have | Full lifecycle coverage (§13) |
