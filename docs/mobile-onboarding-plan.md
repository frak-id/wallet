# Mobile-First Onboarding Plan

## Context

With the Frak mobile app accepted on both App Store and Play Store, the goal is to push users toward the native app experience as much as possible. Two entry paths exist:

1. **Mobile web → App install**: User completes a purchase on a merchant website, shares a referral link (anonymously), and is invited to create a wallet. The goal is to route them into the native app instead of the web wallet.

2. **Desktop web → Mobile app**: User discovers a merchant on desktop, registers a web wallet via SSO, and is later invited to install the mobile app. The challenge: the mobile app creates a *separate* wallet (different WebAuthn origin), so the user ends up with two wallets that must be linked.

The primary constraint is that **WebAuthn credentials cannot be shared between browser and Tauri native app** (different origins). However, the on-chain `MultiWebAuthNValidator` supports multiple credentials per wallet via `addPassKey`. The architecture leverages this to let users control multiple wallets from multiple devices after a pairing ceremony.

### User Demographics

- 33% iOS
- 37% Android
- 30% Desktop

---

## Part 1: Mobile Web → App Install

### User Flow

```
1. User makes a purchase on a merchant website
2. Post-checkout: Frak component appears — "Share this purchase with friends, earn XX"
3. User completes the anonymous sharing flow (referral link created, tracked via clientId)
4. Component transitions to: "Create your wallet to track rewards & get notified"
5. User taps → opens wallet.frak.id/install?merchantId=X&anonymousId=Y
6. Install page stores context + redirects to App Store / Play Store
7. User installs the app, opens it, registers (fresh WebAuthn credential)
8. Post-registration: app connects the anonymous identity to the new wallet
9. User sees their sharing stats, pending rewards, and merchant association
```

Steps 1–3 are fully implemented today. Steps 4–9 are the scope of this plan.

### The Core Problem

After sharing on a merchant website, the anonymous identity (`clientId` + `merchantId`) must reach the native app through an App Store install. Neither iOS nor Android passes URL parameters through the store install process. The app receives nothing on first launch — no referrer, no deep link, no context.

#### WebAuthn Constraint

WebAuthn credentials (passkeys) created in the browser **cannot be reused** by the Tauri native app. Different origins produce different credentials. However, the on-chain `MultiWebAuthNValidator` supports multiple credentials per wallet, so a user can have separate browser and mobile app credentials linked to the same smart wallet.

This means: **the user must register a fresh credential in the native app**. The linking between the anonymous web identity and the new wallet must happen through a separate mechanism.

### Options Analyzed

#### Eliminated

| Option | Reason for Rejection |
|---|---|
| **Server-side fingerprinting** | ~85-95% accuracy, degrades significantly with iCloud Private Relay (~40% of iOS users). One failed match = permanently lost identity link. Too unreliable for a production onboarding flow. |
| **Clipboard token** | iOS 16+ shows a system prompt: "[App] wants to paste from Safari". Users frequently deny it. If the user copies anything else between the install page and app launch, the token is lost. Fragile and feels invasive. |
| **In-app merchant picker** | "Where did you come from?" requires the user to remember the merchant name. High cognitive load at the worst moment (fresh app, unfamiliar UI). Does not scale with multiple merchants. |
| **Universal Links / App Links signal** | No browser provides any JavaScript signal when a Universal Link falls through to the web (app not installed). Zero detection capability. |
| **Firebase Dynamic Links** | Shut down August 2025. Dead. |
| **Branch.io / AppsFlyer / Adjust** | Requires native SDK integration incompatible with Tauri's WebView architecture. Expensive ($299–$1,050+/mo). Overkill for this use case. |
| **WebAuthn passkey sharing (web → app)** | Not possible. Tauri and browser have different WebAuthn origins. Credentials do not sync between them. |

#### Considered but Not Primary

| Option | Assessment |
|---|---|
| **"Go back to merchant site"** | Requires user to manually find and return to the correct Safari tab. Tab may be gone. Merchant site must handle the "return" state. High friction, unpredictable. |
| **Safari bounce (automatic)** | Opening Safari externally from the app causes two visible app-switch animations, a page flash, and an iOS "Open in Frak Wallet?" confirmation dialog. Janky and confusing for users. |

### Chosen Approach: `ASWebAuthenticationSession` (iOS) + Play Install Referrer (Android)

**iOS — `ASWebAuthenticationSession`**

`ASWebAuthenticationSession` is Apple's official API for web-based authentication flows that need to exchange data between a web page and a native app. Key properties:

- **Shares localStorage with Safari** when `prefersEphemeralWebBrowserSession = false`. The install page stored `{ merchantId, anonymousId }` in Safari's localStorage — the session can read it.
- **In-app Safari sheet**, not a full app switch. The user stays in the app; a sheet slides up briefly and auto-dismisses when the redirect completes.
- **Captures custom scheme redirects internally**. When the web page redirects to `frakwallet://merge?token=JWT`, the session intercepts the URL and returns it to the app — no "Open in Frak Wallet?" system dialog.
- **Standard iOS pattern** that users recognize from "Sign in with Google/Apple" and OAuth flows.

The only visible friction: a single system dialog — "Frak Wallet wants to use wallet.frak.id to sign in" — requiring one tap on "Continue".

**Android — Play Install Referrer API**

Google's Play Install Referrer API allows passing arbitrary parameters through the Play Store install process:

- The install page constructs a Play Store URL with a `referrer` query parameter containing the merge token.
- After install and first launch, the app reads the referrer string via `InstallReferrerClient`.
- **100% deterministic**, cryptographically signed by Google, 90-day availability window.
- **Zero user friction** — the referrer is read silently in the background.

**Fallback — Magic Code**

For edge cases where the primary mechanism fails (Safari localStorage evicted, user cancels the ASWebAuthenticationSession dialog, non-Chrome Android browsers):

- The install page displays a short alphanumeric code (6 characters).
- The code maps to `{ merchantId, anonymousId }` stored server-side with a 72-hour TTL.
- Post-registration, the app shows an "Enter your setup code" field.
- The user types the code; the backend resolves it and executes the merge.

This fallback is 100% deterministic, works on all platforms, and requires no browser state.

#### Comparison

| | ASWebAuthenticationSession | Play Install Referrer | Magic Code |
|---|---|---|---|
| **Platform** | iOS | Android | All |
| **User action** | 1 tap ("Continue") | None | Type 6 chars |
| **Reliability** | ~95% (depends on localStorage) | ~100% (Google-signed) | 100% |
| **Requires Tauri plugin** | Yes (Swift, ~50 lines) | Yes (Kotlin, ~100 lines) | No |
| **Role** | iOS primary | Android primary | Universal fallback |

### Architecture — Mobile Web Flow

#### Install Page — `wallet.frak.id/install`

A new route in the wallet web app. Serves as the bridge between the merchant site and the native app.

**Responsibilities:**
1. Parse `merchantId` and `anonymousId` from URL parameters
2. Store them in `localStorage` (for `ASWebAuthenticationSession` to read later)
3. Generate a server-side fallback code (POST to backend, receives 6-char code + token mapping)
4. Display the install page UI: app description, App Store / Play Store buttons, fallback code
5. Construct the Play Store URL with `referrer` parameter (Android)
6. Handle "user returned" state: if the page detects the user came back (visibility change), show a "Open Frak Wallet" Universal Link button

#### Connect Page — `wallet.frak.id/connect`

A lightweight route loaded by `ASWebAuthenticationSession` on iOS.

**Responsibilities:**
1. Read `{ merchantId, anonymousId }` from `localStorage`
2. If found: call `POST /user/identity/merge/initiate` to generate a fresh merge token
3. Redirect to `frakwallet://merge?token={JWT}`
4. If localStorage is empty: redirect to `frakwallet://merge?error=no-data` (triggers code fallback in app)

This page should load and redirect as fast as possible — the user sees it only as a brief flash in the ASWebAuthenticationSession sheet.

#### Tauri Plugins

**iOS — ASWebAuthenticationSession wrapper:**
- Exposes a single Tauri command: `start_web_auth_session(url, callbackScheme) → callbackUrl`
- Sets `prefersEphemeralWebBrowserSession = false` (shares Safari data)
- Returns the full callback URL on success, or an error if the user cancels
- ~50 lines of Swift

**Android — Play Install Referrer reader:**
- Exposes a single Tauri command: `get_install_referrer() → referrerString | null`
- Uses `com.android.installreferrer:installreferrer:2.2` AIDL client
- Reads the referrer on first launch, caches the result
- ~100 lines of Kotlin

#### Backend — Install Code Service

Three endpoints under `/user/identity/install-code/` handle the fallback code mechanism:

- `POST /generate` — **unauthenticated**. Accepts `{ merchantId, anonymousId }`. Generates a 6-char alphanumeric code, stores the mapping in PostgreSQL with 72-hour TTL. Returns `{ code: "ABCD12" }`.
- `POST /resolve` — **unauthenticated**. Accepts `{ code }`. Validates the code, returns merchant context for app display + wallet link status: `{ merchantId, merchant: { name, domain }, hasWallet }`. Does NOT trigger any merge — purely informational.
- `POST /consume` — **authenticated** (requires wallet session via `x-wallet-auth`). Accepts `{ code }`. Resolves the code, finds the source identity group (anonymous_fingerprint), finds the target identity group (wallet from auth session), merges the groups, marks the code as consumed. Returns `{ success, merged }`.

**Why three endpoints instead of two:**
- The app enters the code **before** the user registers/logs in (fresh app install). `resolve` provides merchant info to display ("Connect your rewards from **Acme Store**") without requiring auth.
- `consume` runs after login, when a wallet exists. It performs the actual identity merge in one atomic operation.
- The install page can poll `resolve` to detect when a wallet has been created (the `hasWallet` field flips to `true` after the user registers with the same `anonymousId` via `x-frak-client-id` header).

**Storage:** PostgreSQL (Drizzle) — `install_codes` table in the identity domain. No Redis needed — the code is a durable mapping with 72-hour TTL, not a hot cache. Expired codes filtered by queries; periodic cleanup job optional.

**Code format:** 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars, excluding ambiguous 0/O/1/I/L). 31^6 ≈ 887M combinations. Unique DB index with retry on collision.

**Merge flow in `consume`:**
1. Look up code → `{ merchantId, anonymousId }`
2. Find source group: `findGroupByIdentity({ type: "anonymous_fingerprint", value: anonymousId, merchantId })`
3. Find target group: `findGroupByIdentity({ type: "wallet", value: walletAddress })` (wallet from auth session)
4. If source not found → auto-create via `resolveAndAssociate()` (same pattern as `/track/arrival`)
5. Merge groups via `IdentityWeightService.determineAnchor()` + `IdentityMergeService.mergeGroups()`
6. Mark code as consumed
7. Invalidate caches

**No changes required to:** register, login, existing merge endpoints, AnonymousMergeOrchestrator, SDK, or listener. The app passes the resolved `anonymousId` as its `x-frak-client-id` header during registration (existing plumbing), and calls `consume` separately after auth.

#### App — Post-Install Onboarding Step

The code input can be shown **before or after registration** — the resolve endpoint is unauthenticated:

1. **Pre-registration code entry (optional)**: App shows "Have a setup code?" input. User enters code → `POST /resolve` returns merchant info → app displays "Connect your rewards from **Acme Store**". App stores `{ code, merchantId, anonymousId }` locally.
2. **Registration**: User registers with `x-frak-client-id` set to the resolved `anonymousId` and `merchantId` in body (if available). This links the anonymous identity to the new wallet via existing `resolveAndAssociate()`.
3. **Post-registration merge**: App calls `POST /consume { code }` with wallet auth → identity groups merged, code consumed.
4. **Android**: Silently check Play Install Referrer → if merge token found, auto-merge and show success. Falls back to code input if referrer unavailable.
5. **iOS**: Show "Connect your rewards" button → triggers `ASWebAuthenticationSession` → auto-merge on success. Falls back to code input if cancelled/failed.
6. **Skip**: "Skip for now" link — the user can connect later from settings.

#### Merge Execution

Two merge paths exist depending on the mechanism:

**Primary paths (ASWebAuthenticationSession / Play Install Referrer):**
1. App receives merge token (via ASWebAuth callback or Play Referrer)
2. App registers fresh wallet (new WebAuthn credential → new wallet address)
3. App calls `POST /user/identity/merge/execute` with the merge token
4. Backend merges the anonymous sharing identity group with the new wallet's identity group

**Install code path (fallback):**
1. App resolves code via `POST /install-code/resolve` → gets merchant info (no JWT, no merge token)
2. App registers with the resolved `anonymousId` as `x-frak-client-id` header
3. App calls `POST /install-code/consume` with wallet auth → backend merges identity groups directly
4. No JWT involved — the 6-char code is the only token, valid for 72 hours

The install code approach is simpler than JWT-based merge because:
- The code has a 72-hour TTL (stored server-side), avoiding JWT expiration issues
- The merge happens in one authenticated call — no two-step initiate/execute dance
- Works regardless of app state: fresh install, existing wallet, or returning user
- All referral links, sharing history, and pending rewards transfer to the wallet on merge

### Flow Diagrams — Mobile Web

#### iOS (33% of users)

```
Merchant site
  │ "Create your wallet to track rewards"
  ▼
wallet.frak.id/install?m=X&a=Y
  │ • localStorage.set({ merchantId, anonymousId })
  │ • Display code: "ABCD12"
  │ • Show "Get the App" button
  ▼
App Store → Install → Open app
  │
  ▼
Register (fresh WebAuthn credential → new wallet)
  │
  ▼
"Connect your rewards" button
  │
  ├─── Primary: ASWebAuthenticationSession ──────────────────────┐
  │    System dialog: "wants to use wallet.frak.id" → "Continue" │
  │    Safari sheet opens wallet.frak.id/connect                 │
  │    Page reads localStorage → POST /merge/initiate → token    │
  │    Redirect: frakwallet://merge?token=JWT                    │
  │    Sheet auto-dismisses → app receives token                 │
  │    POST /merge/execute → identity groups merged              │
  │    ✅ Done                                                    │
  │                                                              │
  ├─── Fallback: Code input ─────────────────────────────────────┤
  │    (if ASWebAuth cancelled / localStorage empty)             │
  │    User enters "ABCD12"                                      │
  │    POST /install-code/resolve → { merchant info, hasWallet } │
  │    POST /install-code/consume (with wallet auth) → merged    │
  │    ✅ Done                                                    │
  │                                                              │
  └─── Passive: Safari tab still open ───────────────────────────┘
       User switches to Safari → install page detects return
       Shows "Open Frak Wallet" Universal Link button
       Deep link carries merge token → app merges
       ✅ Done
```

#### Android (37% of users)

```
Merchant site
  │ "Create your wallet to track rewards"
  ▼
wallet.frak.id/install?m=X&a=Y
  │ • localStorage.set({ merchantId, anonymousId })
  │ • Display code: "ABCD12"
  │ • Construct Play Store URL with referrer=mergeToken
  ▼
Play Store → Install → Open app
  │
  ▼
Register (fresh WebAuthn credential → new wallet)
  │
  ▼
Silently read Play Install Referrer → extract merge token
  │
  ├─── Token found: POST /merge/execute → ✅ Done (zero friction)
  │
  └─── Token not found (non-Chrome install):
       Show code input → user enters "ABCD12"
       POST /install-code/resolve → merchant info
       POST /install-code/consume (with wallet auth) → merge → ✅ Done
```

---

## Part 2: Desktop Web → Mobile App

### The Problem

30% of users discover merchants on desktop. They register a wallet via the web SSO popup (`wallet.frak.id/sso`), which creates a wallet with a **browser WebAuthn credential**. Later, they install the mobile app.

The mobile app **cannot access the desktop wallet** — different WebAuthn origins produce different credentials. The `MultiWebAuthNValidator` supports multiple credentials per wallet via `addPassKey(authenticatorId, x, y)`, but executing `addPassKey` requires a signature from an *existing* credential on that wallet. This creates a chicken-and-egg problem: the mobile device can't sign for a wallet it doesn't have access to.

Three additional complications:

1. **User might already have a mobile wallet** (created independently or from a different merchant). Adding a credential to the desktop wallet doesn't merge the mobile wallet's data.
2. **The `addPassKey` UserOp must be signed by the desktop credential**, requiring the desktop browser to be active simultaneously — not guaranteed hours or days after registration.
3. **A single-direction "add device" flow only covers one direction** — the desktop can't sign for the mobile wallet either.

### Architecture Decision: Two Wallets + Mutual Pairing

Instead of trying to share one wallet across devices, **accept that each device creates its own wallet**. Then link them through a **mutual `addPassKey` pairing ceremony** where both devices simultaneously grant each other access.

**After pairing completes:**

- Desktop wallet has: web credential ✅ + mobile credential ✅
- Mobile wallet has: mobile credential ✅ + web credential ✅
- Both devices can sign transactions for **both** wallets
- Backend links both wallets into the **same identity group**
- UI shows **merged data** from both wallets

**Why this is better than single-wallet approaches:**

| Approach | Problem |
|---|---|
| Mobile adds credential to desktop wallet only | Doesn't help if user already has a mobile wallet with its own data. Only one direction. |
| Desktop pre-authorizes mobile credential | Desktop must be active when mobile registers. If user installs app days later, desktop session is long gone. |
| Backend signs `addPassKey` on behalf of user | Requires the smart contract to trust the backend as an authorized signer. Major security implications. |
| **Two wallets + mutual addPassKey** ✅ | Covers all cases: new app user, existing app user, both devices get full control of both wallets. One ceremony. |

The key insight: **one pairing flow handles every case.** Whether the user has zero, one, or two existing wallets before pairing, the ceremony is the same — exchange credentials, sign `addPassKey` on both sides, done.

### Desktop → Mobile Conversion: Layered Nudge Strategy

Desktop users are not blocked from using the web wallet. Instead, they receive **progressive, non-blocking prompts** to install the mobile app. Research shows post-action prompts are 2x more effective than pre-action ones.

**Layer 1 — SSO Success Screen (Immediate)**

The current SSO success screen shows "Redirecting to [Merchant]..." for ~2 seconds. Enhance with a secondary QR code:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ✅ Your wallet is ready!                            │
│                                                     │
│  📱 Get the app              Redirecting to         │
│  ┌──────────────┐           [Merchant Name]...      │
│  │   QR Code    │           [Redirect now →]        │
│  │  (200×200)   │                                   │
│  └──────────────┘                                   │
│  Track rewards on the go                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The QR code is secondary — the redirect still fires automatically. Zero friction added. If the user notices and scans, great. If not, they proceed normally.

The QR code points to App Store / Play Store (platform detected from the scanning device's user agent). No wallet context is embedded — pairing happens later as a separate step.

**Layer 2 — Wallet Dashboard**

The existing `InstallApp` component (`apps/wallet/app/module/wallet/component/InstallApp/`) — currently PWA-only — is enhanced to show native app store links:

```
┌─────────────────────────────────────────────────────┐
│  📱 Get more from Frak Wallet                       │
│                                                     │
│  Install the mobile app for push notifications,     │
│  instant reward alerts, and biometric security.     │
│                                                     │
│  [App Store]  [Google Play]                         │
│                                                     │
│  Already have the app? [Link your devices →]        │
└─────────────────────────────────────────────────────┘
```

**Layer 3 — Post-First-Reward Nudge**

After the user earns their first reward (referral conversion), show a one-time prompt:

```
🎉 You earned 2.50€ from your referral!

📱 Never miss a reward — get instant notifications on your phone.

[Get the app]  [Maybe later]
```

This catches the user at peak engagement (dopamine rush from earning) and ties the app to tangible value (notifications for real money).

**Layer 4 — Settings: "Link Devices"**

Permanent entry point in wallet settings for users who install the app on their own timeline. Initiates the pairing flow described below.

### Device Pairing Protocol

The pairing ceremony reuses the existing WebSocket infrastructure from `packages/wallet-shared/src/pairing/` with a new message protocol.

#### Initiation

Either device can initiate. The initiator:

1. Calls `POST /pairing/create` → receives `{ pairingId, code }` (6-digit alphanumeric)
2. Displays QR code encoding `wallet.frak.id/pair?id={pairingId}` + the 6-digit code as fallback
3. Opens WebSocket connection to `/pairing/ws/{pairingId}`

The other device:

1. Scans QR or enters 6-digit code
2. Joins the same WebSocket channel

#### Credential Exchange

Once both devices are connected over WebSocket:

```
DEVICE A (e.g., Desktop)              DEVICE B (e.g., Mobile)
────────────────────                   ────────────────────

                    ◄─── ws:connected ───►

Send credential_offer:                 Send credential_offer:
{                                      {
  walletAddress: "0xAAA...",             walletAddress: "0xBBB...",
  authenticatorId: "0x123...",           authenticatorId: "0x456...",
  pubKeyX: "0xabc...",                   pubKeyX: "0xdef...",
  pubKeyY: "0x789..."                    pubKeyY: "0x012..."
}                                      }

Both sides now have each other's wallet address + public key.
```

#### Mutual `addPassKey` Signing

Both devices simultaneously:

1. **Build UserOp**: Construct `doAddPasskey(otherDevice.authenticatorId, otherDevice.x, otherDevice.y)` for their *own* wallet
   - Reuses the existing `doAddPassKeyFnAbi` from `packages/wallet-shared/src/recovery/utils/abi.ts`
   - Same UserOp construction as `usePerformRecovery.ts`, but without the recovery context
2. **Biometric prompt**: User confirms with fingerprint / Face ID on each device
3. **Submit UserOp**: Each device submits its own `addPassKey` UserOp to the bundler
4. **Report completion**: Send `ws:signed` message when UserOp is confirmed on-chain

```
DEVICE A                               DEVICE B
────────                               ────────

Build addPassKey(B's cred) for         Build addPassKey(A's cred) for
wallet 0xAAA                           wallet 0xBBB
        │                                      │
        ▼                                      ▼
[Touch ID prompt]                      [Face ID prompt]
"Confirm device linking"               "Confirm device linking"
        │                                      │
        ▼                                      ▼
Submit UserOp                          Submit UserOp
        │                                      │
        ├─── ws:signed ──────────────────►     │
        │     ◄────────────── ws:signed ───────┤
        │                                      │
        ▼                                      ▼
"✅ Devices linked!"                   "✅ Devices linked!"
```

#### Backend Actions on Pairing Completion

When both `ws:signed` messages are confirmed, the backend:

1. Links wallet A and wallet B into the **same identity group** (if not already)
2. Merges any anonymous identities / merchant associations from both wallets' groups
3. Sends `ws:pairing_complete` to both devices with the unified group info
4. Both apps refresh their state to show merged data

#### Partial Failure Handling

If only one side's UserOp succeeds:
- The successful side has the other's credential, but not vice versa
- Backend marks pairing as `partial`
- The failed side shows "Linking incomplete — tap to retry" with a single-tap retry (UserOp is pre-built, just needs re-signing)
- No data is lost — the WebSocket session can persist for retries

If both fail (gas issues, chain congestion):
- Both sides show retry prompt
- Backend can sponsor gas for pairing UserOps (already using Pimlico paymaster)

#### Security: Accidental Cross-Pairing

Two users could theoretically enter each other's pairing codes, granting cross-access to each other's wallets. Mitigation:

- **Visual confirmation**: Before the biometric prompt, both screens display the other device's wallet address (truncated) and a device label. User must visually confirm "Is this your other device?"
- **Short code TTL**: Pairing codes expire after 10 minutes
- **Revocation**: If cross-pairing happens, the user can revoke the rogue credential via `removePassKey` from any authorized device

### Flow Diagram — Desktop → Mobile (Full)

```
Desktop: Merchant site
  │ "Create your wallet to track rewards"
  ▼
SSO popup: wallet.frak.id/sso
  │ Register → WebAuthn credential → Wallet A created
  │ Anonymous identity merged via resolveAndAssociate()
  ▼
SSO success screen (enhanced):
  │ ✅ Wallet ready! + QR code for app + [Redirect now]
  │ Auto-redirect to merchant after 3 seconds
  ▼
User continues browsing on desktop...

  ─── Hours / days later ───

Mobile: User installs app (from QR, dashboard prompt, or organically)
  │
  ▼
App opens → Register → fresh WebAuthn credential → Wallet B created
  │
  ▼
App shows: "Do you have a wallet on another device?"
  │
  ├─── Yes → "Link your devices" ─────────────────────────────────┐
  │                                                                │
  │    Mobile shows QR code + 6-digit pairing code                 │
  │    User opens wallet.frak.id on desktop                        │
  │    Desktop wallet dashboard shows "Link devices" prompt        │
  │    (or user navigates to Settings → Link Devices)              │
  │    Desktop scans QR / enters code                              │
  │           │                                                    │
  │           ▼                                                    │
  │    WebSocket connected                                         │
  │    Credential exchange (wallet addresses + public keys)        │
  │           │                                                    │
  │           ▼                                                    │
  │    Desktop: biometric prompt → signs addPassKey(mobile cred)   │
  │    Mobile: biometric prompt → signs addPassKey(desktop cred)   │
  │           │                                                    │
  │           ▼                                                    │
  │    Both UserOps submitted → confirmed on-chain                 │
  │    Backend merges identity groups                              │
  │    Both apps refresh → unified view                            │
  │    ✅ Done                                                      │
  │                                                                │
  ├─── No → Continue with Wallet B only ───────────────────────────┤
  │    User may pair later from Settings → Link Devices            │
  │                                                                │
  └─── Skip → Same as "No" ───────────────────────────────────────┘
```

---

## Multi-Wallet Identity Groups — Backend Impact

### Architecture Decision

**Current state**: Identity groups are locked to **one wallet per group**.

**Required change**: Allow **multiple wallets per identity group**, with all queries aggregating across wallets in the group.

This is the highest-impact backend change in this plan. Every query that currently filters by `wallet_address` must be updated to filter by `identity_group_id` instead (or aggregate across all wallets in the group).

### Affected Domains

| Domain | Impact | Details |
|---|---|---|
| **Rewards** | 🔴 High | `getRewardsByWallet` → `getRewardsByGroup`. Reward totals must sum across wallets. Claim eligibility must check all wallets in group. |
| **Interactions** | 🔴 High | Interaction history aggregated across wallets. Deduplication needed (same interaction from two wallets = one event). |
| **Campaigns** | 🟡 Medium | Campaign participation tracked per group, not per wallet. User shouldn't appear twice in campaign analytics. |
| **Identity** | 🟡 Medium | `resolveAndAssociate()` must handle groups with multiple wallets. Merge logic must handle group-to-group merges (not just anonymous-to-wallet). |
| **Wallet API** | 🟡 Medium | API responses that return wallet-specific data need a "for which wallet?" parameter or return aggregated data. |
| **Auth** | 🟢 Low | Login still authenticates a specific wallet. Session carries both `walletAddress` and `groupId`. |

### Data Model Change

Current: `identity_group` → 1:1 → `wallet`

After: `identity_group` → 1:N → `wallet`

The `wallet` table needs a `group_id` foreign key (may already exist via the identity node system — needs verification during implementation).

### Query Pattern Migration

```sql
-- Before: single wallet
SELECT * FROM rewards WHERE wallet_address = ?

-- After: all wallets in group
SELECT * FROM rewards WHERE wallet_address IN (
  SELECT wallet_address FROM wallets WHERE group_id = ?
)
```

Alternative: add `group_id` column directly to rewards/interactions tables (denormalization for performance at the cost of write-time bookkeeping).

### API Response Strategy

Two patterns coexist:

**Aggregated responses** (for most endpoints — rewards, interactions, campaigns):

```json
{
  "totalRewards": "12.50",
  "wallets": ["0xAAA...", "0xBBB..."],
  "rewards": [
    { "merchant": "Acme", "amount": "7.00", "wallet": "0xAAA..." },
    { "merchant": "Beta", "amount": "5.50", "wallet": "0xBBB..." }
  ]
}
```

**Per-wallet responses** (for wallet-specific operations — balance, signing):

```json
// GET /wallet/0xAAA.../balance
{ "balance": "7.00" }
```

The app knows about both wallets and queries accordingly.

---

## Side Effects & Migration

### Enabling Multi-Wallet Identity Groups

This is the most consequential change in the plan. Current assumptions that need updating:

1. **"Get wallet for user" queries**: Currently return a single wallet. Must return an array or accept a group-level query parameter.

2. **Reward distribution**: If rewards are sent to a specific wallet address on-chain, the user needs to specify which wallet receives them — or they default to the wallet that earned them (most natural behavior).

3. **Transaction signing**: When the app needs to sign a transaction (e.g., claim rewards), it must select the correct wallet+credential pair. The transaction target (wallet A or B) determines which credential signs.

4. **Session management**: Current session stores `walletAddress`. Must also store `groupId` and the list of wallets the user has credentials for on this device.

5. **Analytics deduplication**: A user with two wallets should count as one user in campaign analytics, not two.

6. **Interaction tracking**: If user A refers user B, and user B has two wallets, the referral should be attributed once (at the group level), not per-wallet.

### Migration Path

1. Add `group_id` to wallet-related tables (if not already present via identity nodes)
2. **Existing users**: every wallet is in a 1:1 group — no behavior change, fully backwards compatible
3. New pairing creates N:1 relationships in the same group
4. Queries migrate incrementally — start with rewards and interactions (highest user impact), then campaigns and analytics
5. Frontend wallet views add multi-wallet awareness (show aggregated data, indicate source wallet per item)

---

## Implementation Effort

### Part 1: Mobile Web → App Install

| Component | Effort | Priority |
|---|---|---|
| `wallet.frak.id/install` page (stores context, shows code, App Store links) | ~2 days | P0 |
| `wallet.frak.id/connect` page (reads localStorage, generates token, redirects) | ~1 day | P0 |
| Tauri plugin: ASWebAuthenticationSession (iOS, Swift) | ~1 day | P0 |
| Tauri plugin: Play Install Referrer (Android, Kotlin) | ~1-2 days | P0 |
| Backend: install code endpoints (generate, resolve, consume) | ~1 day | P0 |
| App: post-registration "Connect rewards" screen | ~1 day | P0 |
| SDK: new component or modal step for "Create wallet" CTA | ~1 day | P1 |
| **Subtotal** | **~7-8 days** | |

### Part 2: Desktop Web → Mobile App

| Component | Effort | Priority |
|---|---|---|
| Enhanced SSO success screen (QR code + app store links) | ~1 day | P1 |
| Enhanced `InstallApp` dashboard component (app store links + "Link devices") | ~0.5 days | P1 |
| Post-first-reward nudge component | ~0.5 days | P2 |
| Device pairing: WebSocket protocol (new message types, credential exchange) | ~2 days | P1 |
| Device pairing: UI on both web and mobile app | ~2 days | P1 |
| `addPassKey` UserOp construction outside recovery flow | ~1 day | P1 |
| **Backend: multi-wallet identity groups (schema, queries, API)** | **~3-5 days** | **P1** |
| Backend: pairing endpoints (create, join, complete, partial retry) | ~1 day | P1 |
| App: merged wallet views (dashboard, rewards, history) | ~2-3 days | P1 |
| **Subtotal** | **~13-17 days** | |

### Total: ~20-25 days

Part 1 (mobile web → app) can ship independently. Part 2 (desktop → mobile + pairing) is a separate phase that builds on Part 1.

---

## Edge Cases

### Mobile Web Flow

| Scenario | Handling |
|---|---|
| ASWebAuthenticationSession cancelled by user | App shows code input fallback |
| Safari evicted localStorage (iOS memory pressure) | `/connect` page redirects with `error=no-data` → code fallback |
| Play Install Referrer unavailable (sideloaded APK, non-Chrome) | Code fallback |
| Merge token expired (60-min JWT TTL) | `/connect` page generates a fresh token each time; install code has no JWT — the 6-char code is valid for 72 hours |
| User installs app days later | Server-side code persists 72 hours; localStorage persists indefinitely; Play Referrer available 90 days |
| User skips "Connect rewards" step | Anonymous sharing data persists server-side. User can connect later from app settings. |
| User already has the app installed | Existing deep link flow (`frakwallet://`) opens the app directly from the merchant site — no install page needed. Detection via `getInstalledRelatedApps()` on Android Chrome. |

### Desktop → Mobile + Pairing

| Scenario | Handling |
|---|---|
| User already has mobile wallet when pairing | Mutual addPassKey handles it — both wallets get both credentials, identity groups merge. This is the primary use case. |
| User has no desktop wallet (mobile-only user) | No pairing needed. Standard mobile flow (Part 1) applies. |
| One `addPassKey` UserOp fails during pairing | Mark pairing as `partial`. Show retry prompt on the failed side. Other side's credential is already added successfully. |
| Both `addPassKey` UserOps fail | Show retry on both sides. WebSocket session persists. Backend can sponsor gas for retry attempts. |
| User initiates pairing but other device is offline | Pairing code is valid for 10 minutes. Show "Waiting for other device..." with timeout and re-generate option. |
| User has 3+ devices (desktop + phone + tablet) | Pairing is pairwise. Phone↔Desktop, then Tablet↔Desktop (or Tablet↔Phone). Each ceremony adds credentials to two wallets. Identity group grows with each pairing. |
| Two different users accidentally pair (wrong code) | Credential exchange gives cross-access — destructive. **Mitigation**: show wallet addresses on both screens for visual confirmation before the biometric prompt. Short code TTL (10 min). Post-incident: `removePassKey` to revoke. |
| User pairs, then loses one device | Remaining device still has credentials for both wallets. User can revoke the lost device's credentials via `removePassKey`. |
| Same user pairs same devices twice | Idempotent — `addPassKey` with an existing authenticator is a no-op on-chain. Backend detects wallets already in same group. |
| User never pairs (desktop + mobile, separate wallets) | Both wallets work independently. User sees separate data on each. Dashboard nudges toward pairing. |

---

## Future Enhancements

- **`getInstalledRelatedApps()` on Android Chrome**: Add `related_applications` to `manifest.json` to detect if the app is installed before showing install prompts. ~85% Android Chrome coverage.
- **Smart App Banner on iOS Safari**: Add `<meta name="apple-itunes-app">` to wallet.frak.id pages for passive "Open / Get" banner. Zero code, Safari-only.
- **Push notification after merge**: Immediate push confirming rewards are connected, reinforcing app value.
- **Automatic pairing suggestion**: If the anonymous merge reveals that a mobile user's anonymous identity is already in a desktop wallet's group, proactively suggest pairing instead of waiting for manual initiation.
- **Wallet consolidation (v2)**: After pairing, offer to migrate all data to a single wallet and deactivate the other. Reduces long-term complexity of multi-wallet queries.
- **Cross-device transaction signing**: After pairing, allow desktop to request mobile to sign a transaction (or vice versa) via the WebSocket channel — useful for scenarios where one device has better security (biometric) than the other.

---

## Key Code References

| Component | Location |
|---|---|
| `MultiWebAuthNValidator` ABI (`addPassKey`, `removePassKey`) | `packages/app-essentials/src/blockchain/abis/kernelV2Abis.ts` |
| `doAddPassKeyFnAbi` (for UserOp construction) | `packages/wallet-shared/src/recovery/utils/abi.ts` |
| Recovery `addPassKey` flow (reference implementation) | `apps/wallet/app/module/recovery/hook/usePerformRecovery.ts` |
| Recovery passkey creation with `previousWallet` | `apps/wallet/app/module/recovery/hook/useCreateRecoveryPasskey.ts` |
| Register endpoint (`previousWallet` parameter) | `services/backend/src/api/user/wallet/auth/register.ts` |
| Login endpoint (identity resolution pattern) | `services/backend/src/api/user/wallet/auth/login.ts` |
| Anonymous merge orchestrator | `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts` |
| Anonymous merge JWT service | `services/backend/src/domain/identity/services/AnonymousMergeService.ts` |
| Identity orchestrator (`resolveAndAssociate`) | `services/backend/src/orchestration/identity/IdentityOrchestrator.ts` |
| Identity repository (group/wallet lookups) | `services/backend/src/domain/identity/repositories/IdentityRepository.ts` |
| Identity DB schema (groups + nodes) | `services/backend/src/domain/identity/db/schema.ts` |
| Merchant repository (name, domain lookup) | `services/backend/src/domain/merchant/repositories/MerchantRepository.ts` |
| Orchestration context (singleton wiring) | `services/backend/src/orchestration/context.ts` |
| Identity domain context | `services/backend/src/domain/identity/context.ts` |
| Install code schema **(new)** | `services/backend/src/domain/identity/db/installCodeSchema.ts` |
| Install code repository **(new)** | `services/backend/src/domain/identity/repositories/InstallCodeRepository.ts` |
| Install code service **(new)** | `services/backend/src/domain/identity/services/InstallCodeService.ts` |
| Install code API routes **(new)** | `services/backend/src/api/user/identity/installCode.ts` |
| Existing WebSocket pairing infra | `packages/wallet-shared/src/pairing/` |
| `LaunchPairing` component (QR + code) | `packages/wallet-shared/src/pairing/component/LaunchPairing/` |
| SSO success screen | `apps/wallet/app/routes/_wallet/_sso/sso.tsx` |
| SSO button (mobile/desktop branching) | `apps/listener/app/module/component/SsoButton.tsx` |
| `InstallApp` component (PWA, to be enhanced) | `apps/wallet/app/module/wallet/component/InstallApp/` |
| Deep link parsing/routing | `apps/wallet/app/utils/deepLink.ts` |
| WebAuthn RP config | `packages/app-essentials/src/webauthn/index.ts` |
