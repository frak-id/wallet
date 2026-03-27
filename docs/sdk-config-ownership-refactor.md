# SDK Config Ownership Refactor

**Date:** 2026-03-26
**Status:** Draft
**Branch:** dev (built on top of SDK config feature commits)

## Problem Statement

The current SDK config architecture has three issues:

1. **Duplicate `/resolve` calls.** Both the SDK (`fetchMerchantId()`) and the listener (`fetchMerchantByDomain()`) independently call `GET /user/merchant/resolve` for the same domain. The SDK discards everything except `merchantId`; the listener uses `merchantId` + `sdkConfig`. Up to 3 calls can happen per page load (listener auto-context, listener handshake, SDK fetchMerchantId).

2. **SDK components are unreachable by backend config.** All three i18n/CSS channels (SDK static config, per-modal overrides, backend `sdkConfig`) only target the listener iframe. The Web Components (`<frak-button-share>`, etc.) in the parent page have zero access to backend-driven config — text is hardcoded via HTML attributes with no localization.

3. **No placement/screen concept.** A single merchant-wide config can't handle different share buttons on different pages (homepage hero vs blog sidebar) with different text, target interactions, or translations. There's no way to configure "this specific button does X" from the dashboard.

## Goals

- **Single `/resolve` call** — SDK owns it, forwards result to listener.
- **Unified config store on SDK side** — components and modals both read from it.
- **Placement system** — named experiences configurable from the business dashboard, each with trigger config (button props) + experience config (translations, targetInteraction, CSS).
- **No layout shift** — `waitForBackendConfig` option (default: `true`) gates component rendering until backend config is resolved.
- **Simplified i18n cascade** — clear priority chain, remove URL-based i18n from SDK config.

## Non-Goals

- A/B testing on placements (future work).
- Placement analytics (future work).
- Dashboard UI for placement management (separate task, but the schema must support it).

---

## Architecture

### Current Flow

```
SDK (parent page)                          Listener (iframe)
─────────────────                          ─────────────────
fetchMerchantId() ──GET /resolve──┐
  └─ discards sdkConfig           │
                                  │        auto-context ──GET /resolve──┐
handshake ──postMessage──────────►│                                    │
  {configDomain, lang}            │        handshake ──GET /resolve────┘
                                  │          └─ applies sdkConfig (CSS, i18n)
postConnectionSetup()             │
  └─ pushCss() ──lifecycle──────►│        modal-css handler
  └─ pushI18n() ─lifecycle──────►│        modal-i18n handler
```

### New Flow

```
SDK (parent page)                          Listener (iframe)
─────────────────                          ─────────────────
createIframe()     ─── parallel ──┐
fetchMerchantConfig() ──GET /resolve──►backend
  └─ returns { merchantId, sdkConfig }
  └─ stores in SDK config store   │
  └─ components can render        │
                                  │
handshake ──postMessage──────────►│
  {token, currentUrl, clientId,   │        validates token
   configDomain}                  │        stores merchantId + context
                                  │        (NO /resolve call)
                                  │
resolved-config ──lifecycle─────►│        applies CSS, translations
  {sdkConfig, placements}         │        stores metadata
                                  │
postConnectionSetup()             │
  └─ pushCss() (customizations)──►│       modal-css handler (unchanged)
  └─ pushI18n() (customizations)─►│       modal-i18n handler (unchanged)
```

**Key changes:**
- `/resolve` is called once, by the SDK, in parallel with iframe creation.
- Listener receives resolved config via a new `resolved-config` lifecycle message.
- Listener never calls `/resolve` itself (remove `fetchMerchantByDomain()`).
- SDK stores config locally — components read from it reactively.
- `customizations.css` (URL) and `customizations.i18n` (inline objects) remain as developer-side overrides, pushed to listener via existing `modal-css` / `modal-i18n` lifecycle messages.

---

## Type Definitions

### Backend — DB Schema (`SdkConfig`)

This is what gets stored in the `merchants.sdk_config` JSONB column.

```typescript
type SdkConfig = {
    // ──── Global merchant defaults ────
    name?: string | null;
    logoUrl?: string | null;
    homepageLink?: string | null;
    currency?: "eur" | "usd" | "gbp" | null;
    lang?: "en" | "fr" | null;
    css?: string | null;

    // Global translations (listener modal defaults)
    // Tiered: default applied first, then language-specific merged on top.
    translations?: {
        default?: Record<string, string>;
        en?: Record<string, string>;
        fr?: Record<string, string>;
    } | null;

    // ──── Named placements (max 10 per merchant) ────
    // Placement IDs: 3–16 chars, a-zA-Z0-9_- only.
    placements?: Record<string, Placement> | null;
};

type Placement = {
    // The visible trigger (button/widget config).
    // Omit for programmatic-only placements (e.g. displayModal with placement ID).
    trigger?: {
        text?: string;
        noRewardText?: string;
        position?: "bottom-right" | "bottom-left";
        showWallet?: boolean;
    };

    // The experience this placement drives.
    // Shared between the trigger component AND the modal/embedded wallet it opens.
    targetInteraction?: string;

    // i18n overrides scoped to this placement.
    // Merged ON TOP of global sdkConfig.translations when this placement is active.
    // Same tiered structure: default + language-specific.
    translations?: {
        default?: Record<string, string>;
        en?: Record<string, string>;
        fr?: Record<string, string>;
    };

    // CSS overrides for modals/views triggered by this placement.
    css?: string;
};
```

### Backend — Resolved Response (`ResolvedSdkConfig`)

This is what the `/resolve` endpoint returns after language resolution and translation merging. The backend flattens translation tiers into a single `Record<string, string>` per scope.

```typescript
type ResolvedSdkConfig = {
    name?: string;
    logoUrl?: string;
    homepageLink?: string;
    currency?: "eur" | "usd" | "gbp";
    lang: "en" | "fr";
    css?: string;
    translations?: Record<string, string>;

    placements?: Record<string, ResolvedPlacement>;
};

type ResolvedPlacement = {
    trigger?: {
        text?: string;
        noRewardText?: string;
        position?: "bottom-right" | "bottom-left";
        showWallet?: boolean;
    };
    targetInteraction?: string;
    // Already flattened: default + lang-specific merged into one record
    translations?: Record<string, string>;
    css?: string;
};
```

### SDK — Config Type (`FrakWalletSdkConfig`)

Developer-facing config. **Changes are minimal** — keep existing fields, add `waitForBackendConfig`.

```typescript
type FrakWalletSdkConfig = {
    walletUrl?: string;
    metadata: {
        name?: string;
        merchantId?: string;
        lang?: Language;
        currency?: Currency;
        logoUrl?: string;
        homepageLink?: string;
    };
    // KEPT — developer-side overrides, applied AFTER backend config
    customizations?: {
        css?: `${string}.css`;      // URL to external CSS (unchanged)
        i18n?: I18nConfig;          // Inline i18n objects only (remove URL support)
    };
    domain?: string;
    // NEW — wait for backend config before rendering components
    // Default: true
    waitForBackendConfig?: boolean;
};
```

**Changes to `I18nConfig`:**
- Remove the URL variant from `LocalizedI18nConfig` (no more `"en": "https://example.com/en.json"`).
- Keep inline objects: `Record<Language, Record<string, string>> | Record<string, string>`.

```typescript
// Before
type LocalizedI18nConfig = `${string}.css` | { [key: string]: string };

// After
type LocalizedI18nConfig = { [key: string]: string };
```

### SDK — Resolved Config Store

New internal store on the SDK side. Components subscribe to this reactively.

```typescript
type SdkResolvedConfig = {
    // Resolution state
    isResolved: boolean;

    // Merged config (backend > SDK static > defaults)
    merchantId: string;
    name?: string;
    logoUrl?: string;
    homepageLink?: string;
    lang?: Language;
    currency?: Currency;

    // Global translations (for reference / component fallback)
    translations?: Record<string, string>;

    // Placements (keyed by placement ID)
    placements?: Record<string, ResolvedPlacement>;
};
```

### Listener — Updated Context Type

```typescript
type IFrameResolvingContext = {
    merchantId: string;
    origin: string;
    sourceUrl: string;
    isAutoContext: boolean;
    clientId?: string;
    // REMOVED: sdkConfig is no longer resolved by the listener.
    // Config comes via the "resolved-config" lifecycle message.
};
```

### New Lifecycle Event (`resolved-config`)

```typescript
type ResolvedConfigEvent = {
    clientLifecycle: "resolved-config";
    data: {
        sdkConfig: ResolvedSdkConfig;  // Full resolved config from backend
    };
};
```

Added to `ClientLifecycleEvent` union in `sdk/core/src/types/lifecycle/client.ts`.

---

## i18n Cascade (Final)

### Priority (highest wins)

```
1. Backend placement translations   (business admin, per-placement)
2. Backend global translations      (business admin, merchant-wide)
3. Per-call i18n                    (developer, displayModal/embedded metadata)
4. SDK customizations.i18n          (developer, static config)
5. Built-in customized.json         (Frak defaults, per-language)
6. Built-in translation.json        (Frak base translations, fallback namespace)
```

### Application Order (listener side)

All translations write to the i18next `"customized"` namespace with `overwrite: true`. Application order determines final state (last write wins for same key):

1. SDK pushes `customizations.i18n` → `modal-i18n` lifecycle → `mapI18nConfig()` writes to `"customized"` namespace.
2. SDK pushes `resolved-config` → listener applies `sdkConfig.translations` → writes to `"customized"` namespace (overwrites step 1 for overlapping keys).
3. On modal/embedded display → `populateI18nResources()` applies per-call i18n → writes to `"customized"` namespace (cloned instance, does not overwrite step 2 globally).
4. On modal/embedded display with placement → placement translations merged on top of step 3.

### Application Order (component side)

Components read text in this order:
1. Active placement's `trigger.text` / `trigger.noRewardText`
2. Active placement's `translations["components.share.text"]` (if trigger field is absent)
3. HTML attribute (`<frak-button-share text="...">`)
4. SDK static config default (if we add component defaults to config)
5. Hardcoded component default (`"Share and earn!"`)

---

## Component Changes

### `<frak-button-share placement="X">`

New `placement` attribute on all Web Components. When present:
- Reads `trigger.*` props from the placement config.
- Uses `targetInteraction` from placement.
- When triggering a modal/embedded wallet, passes placement ID so the listener can apply placement-scoped translations + CSS.

### `waitForBackendConfig` Behavior

```
initFrakSdk()
├── Start fetchMerchantConfig() + createIframe() in parallel
├── fetchMerchantConfig() resolves
│   ├── Merge backend config > SDK static config
│   ├── Store in SdkResolvedConfig
│   └── Mark isResolved = true
├── dispatchClientReadyEvent()    ← fires after config resolution
└── Components: useClientReady() now checks isResolved
```

If `waitForBackendConfig: false`:
- `dispatchClientReadyEvent()` fires after iframe connection only (current behavior).
- Components render immediately with SDK static config / HTML attributes.
- Backend config applies reactively when it arrives (may cause text change).

If `waitForBackendConfig: true` (default):
- Components show `<Spinner />` until `isResolved = true`.
- No layout shift, no text flash.

---

## Backend Changes

### `/resolve` Endpoint Changes

**Request:** `GET /user/merchant/resolve?domain=X&lang=Y`

No change to the request shape. The `lang` param is now sent by the SDK instead of the listener.

**Response:** Extended with `placements`:

```typescript
{
    merchantId: string;
    productId: string;
    name: string;
    domain: string;
    sdkConfig?: {
        name?: string;
        logoUrl?: string;
        homepageLink?: string;
        currency?: "eur" | "usd" | "gbp";
        lang: "en" | "fr";
        css?: string;
        translations?: Record<string, string>;        // Flattened global
        placements?: Record<string, ResolvedPlacement>; // NEW
    };
}
```

### `buildResolvedSdkConfig()` Changes

Extend to also resolve placements:
- For each placement, flatten `translations.default` + `translations[lang]` into a single `Record<string, string>`.
- Pass through `trigger`, `targetInteraction`, `css` unchanged.

### DB Migration

The existing `sdk_config` JSONB column already accepts arbitrary JSON. The `placements` field is additive — no migration needed for the column itself.

A Drizzle migration is needed only to update the TypeScript `SdkConfig` type (already done via schema change). No SQL DDL change required since it's JSONB.

### Dashboard API (`/business/merchant/sdkConfig`)

Extend the existing PUT endpoint to accept placements:
- Validate placement structure.
- Validate translation keys (optional — can be lenient since it's JSONB).
- Store in `sdk_config` column.

---

## Files Changed

### SDK Core (`sdk/core/`)

| File | Change |
|------|--------|
| `src/utils/merchantId.ts` | Expand `fetchMerchantId()` → `fetchMerchantConfig()`. Return full `ResolvedSdkConfig`. Keep `fetchMerchantId()` as a thin wrapper for backward compat. |
| `src/utils/sdkConfigStore.ts` | **NEW.** Reactive config store (simple event emitter pattern, no framework deps). Holds `SdkResolvedConfig`. |
| `src/clients/createIFrameFrakClient.ts` | Call `fetchMerchantConfig()` in parallel with iframe creation. Send `resolved-config` lifecycle event after connection. Integrate `waitForBackendConfig` into `waitForSetup`. |
| `src/clients/transports/iframeLifecycleManager.ts` | Remove `lang` from handshake response (no longer needed — SDK resolved it). Keep `configDomain` for edge cases where SDK overrides domain. |
| `src/types/lifecycle/client.ts` | Add `ResolvedConfigEvent` to `ClientLifecycleEvent` union. |
| `src/types/config.ts` | Add `waitForBackendConfig?: boolean` to `FrakWalletSdkConfig`. Remove URL variant from `LocalizedI18nConfig`. |
| `src/types/resolvedConfig.ts` | **NEW.** Types for `ResolvedSdkConfig`, `ResolvedPlacement`, `SdkResolvedConfig`. |
| `src/index.ts` | Export new types and config store. |

### SDK Components (`sdk/components/`)

| File | Change |
|------|--------|
| `src/utils/initFrakSdk.ts` | Await config resolution before dispatching `clientReadyEvent` (when `waitForBackendConfig` is true). |
| `src/hooks/useClientReady.ts` | Also check `sdkConfigStore.isResolved` when `waitForBackendConfig` is true. |
| `src/hooks/usePlacement.ts` | **NEW.** Hook to read placement config by ID from the SDK config store. |
| `src/utils/registerWebComponent.ts` | Support new `placement` attribute on all components. |
| `src/components/ButtonShare/ButtonShare.tsx` | Read `text`, `noRewardText`, `targetInteraction`, `showWallet` from placement if `placement` attribute is set. Fallback to HTML attributes → defaults. |
| `src/components/ButtonWallet/ButtonWallet.tsx` | Same pattern — placement props override HTML attributes. |
| `src/components/OpenInAppButton/OpenInAppButton.tsx` | Same pattern. |

### Listener (`apps/listener/`)

| File | Change |
|------|--------|
| `app/module/stores/resolvingContextStore.ts` | Remove `fetchMerchantByDomain()`. Remove auto-context `/resolve` call. Remove `sdkConfig` from `IFrameResolvingContext`. Keep handshake for `merchantId` + `origin` + `clientId` — but `merchantId` now comes from the SDK's `resolved-config` message (or stays as handshake fallback for backward compat). |
| `app/module/stores/types.ts` | Remove `sdkConfig` from `IFrameResolvingContext`. Add separate `backendConfig` store or field for config received via lifecycle. |
| `app/module/handlers/lifecycleHandler.ts` | Add `resolved-config` case. Apply CSS, translations, store metadata. Remove `applyBackendSdkConfig()` subscription (no longer needed — config arrives explicitly). When a modal/embedded request references a placement, apply placement translations on top. |
| `app/module/utils/resolveBackendMetadata.ts` | Read from the new config source instead of `resolvingContextStore.context.sdkConfig`. |
| `app/module/hooks/useDisplayModalListener.ts` | Accept optional `placement` param from RPC. Merge placement translations into modal i18n. |
| `app/module/hooks/useDisplayEmbeddedWallet.ts` | Same — placement support. |
| `app/module/providers/ListenerUiProvider.tsx` | Read backend config from new source. Language/currency fallback chain updated. |

### Backend (`services/backend/`)

| File | Change |
|------|--------|
| `src/domain/merchant/schemas/index.ts` | Add `PlacementSchema`, `placements` field to `SdkConfigSchema`. |
| `src/api/schemas/merchantApiSchemas.ts` | Add `ResolvedPlacementSchema`, extend `ResolvedSdkConfigSchema` with `placements`. |
| `src/api/user/merchant/index.ts` | Extend `buildResolvedSdkConfig()` to resolve placement translations (flatten tiers per placement). |
| `src/api/business/merchant/sdkConfig.ts` | Extend PUT handler to validate and store placements. |

### RPC Types (`packages/rpc/` or `sdk/core/src/types/rpc.ts`)

| File | Change |
|------|--------|
| `sdk/core/src/types/rpc.ts` | Add optional `placement?: string` parameter to `frak_displayModal` and `frak_displayEmbeddedWallet` methods. |

---

## Migration & Backward Compatibility

### SDK Version Bump

This is a **minor** version bump (new features, no breaking changes for existing integrations):
- `waitForBackendConfig` defaults to `true` but existing integrations without backend config will resolve immediately (empty config = resolved).
- `placement` attribute is optional — components work without it.
- `customizations.css` and `customizations.i18n` continue to work.
- `fetchMerchantId()` remains exported (thin wrapper around new `fetchMerchantConfig()`).

### Listener Backward Compat

The listener must handle both:
- **New SDK** (sends `resolved-config` lifecycle message) → uses that config.
- **Old SDK** (no `resolved-config` message) → falls back to self-fetching from `/resolve` (keep `fetchMerchantByDomain()` behind a flag, remove in next major).

Detection: if `resolved-config` message is received, set a flag. If handshake completes without it and a timeout passes, fall back to self-fetch.

### `LocalizedI18nConfig` URL Removal

Breaking change for anyone using URL-based i18n:
```typescript
// This will no longer work:
customizations: { i18n: { en: "https://example.com/en.json" } }
```

Mitigation: document in changelog. Users should inline their translations or use the backend config dashboard. This is an acceptable break — the URL fetch was fragile (CORS, latency, failure modes) and the backend config replaces it cleanly.

---

## Phasing

### Phase 1 — Config Ownership Flip

**SDK becomes the single `/resolve` caller. Config flows SDK → listener.**

- Expand `fetchMerchantId()` into `fetchMerchantConfig()` (returns full response).
- Create `sdkConfigStore` on SDK side.
- Add `resolved-config` lifecycle event.
- Listener handles `resolved-config`, applies CSS/translations.
- Listener keeps self-fetch as backward compat fallback.
- Add `waitForBackendConfig` flag.
- Components gate on `isResolved`.
- Remove `LocalizedI18nConfig` URL variant.

**Validates:** Single `/resolve` call, no layout shift, config flows correctly.

### Phase 2 — Placements

**Named experiences configurable from the dashboard.**

- Add `placements` to `SdkConfig` schema (backend).
- Backend resolves placement translations (flatten tiers).
- SDK config store exposes `placements`.
- Components accept `placement` attribute.
- `displayModal` / `displayEmbeddedWallet` accept `placement` parameter.
- Listener applies placement-scoped translations + CSS.
- Dashboard UI for managing placements (separate frontend task).

**Validates:** Multiple buttons with different configs on same page, placement translations applied to triggered modals.

### Phase 3 — Cleanup & Polish

- Remove listener self-fetch fallback (breaking for old SDKs — major version).
- Remove `lang` from handshake response (no longer needed).
- Remove listener's `fetchMerchantByDomain()` entirely.
- Audit and remove dead code paths.

---

## Decisions

1. **Placement ID validation** — Backend validates: 3–16 characters, `a-zA-Z0-9_-` only. Reject anything else.
2. **Placement limit** — Max 10 placements per merchant initially. Can be raised later.
3. **Cache invalidation** — Current 30s TTL (sessionStorage + in-memory) is sufficient. No cache-bust mechanism for now.
4. **Listener backward compat timeout** — Listener waits max 2 seconds for the `resolved-config` lifecycle message. If not received, falls back to self-fetch via `/resolve`.
5. **Component default text** — Stays hardcoded in each component file. Moving to `customized.json` would require components to depend on the listener i18n response round-trip, which contradicts the `waitForBackendConfig` design (SDK-side only, no listener dependency for rendering).
