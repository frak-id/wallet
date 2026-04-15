# iOS App Clips for Frak Wallet

## Why App Clips?

Today, when an iOS user on a merchant website interacts with the Frak SDK and needs to install the wallet, they hit a painful flow:

1. SDK tries `frakwallet://install` deep link — fails (app not installed)
2. Fallback to `https://wallet.frak.id/install` web page
3. User sees a **6-digit Install Code**
4. User goes to App Store, downloads the full app
5. User opens the app, **manually enters the code**
6. Identity merge (`ensure`) finally happens

Every manual step is a conversion cliff. Android solves this with the Play Store `referrer` parameter. iOS has no equivalent — except App Clips.

## What Is an App Clip?

An App Clip is a lightweight (<15MB, or <50MB for URL-invoked on iOS 17+) slice of your app that launches **instantly** from a website — no App Store visit required. It's a native experience that lives between "web page" and "full app install."

Our full Tauri app is 6-7MB. A stripped-down App Clip for the install flow would be ~3MB.

## The Proposed Flow

```
Merchant Website (with Frak SDK)
    │
    ├── iframe modal (login/share/tx)     ← stays as-is, works everywhere
    │
    └── Smart App Banner (iOS only)
         │
         └── User taps "Open" on App Clip Card
              │
              ▼
         SwiftUI App Clip (~3MB)
              │
              ├── 1. Parse invocation URL
              │      ?m=merchant_id&c=campaign_id&a=anonymous_id
              │
              ├── 2. WebAuthn Passkey (create or authenticate)
              │      via AuthenticationServices — native Face ID / Touch ID
              │
              ├── 3. Call /ensure API (identity merge)
              │      deterministic attribution, no install code needed
              │
              ├── 4. (Optional) Start Live Activity
              │      "Tracking 5% Frak Reward..." on Lock Screen
              │
              ├── 5. Native share sheet (referral link)
              │
              ├── 6. Save session → Shared Keychain
              │
              └── 7. "Get Full Wallet" → App Store
                      │
                      ▼
                 Full Tauri app launches
                      → already logged in
                      → attribution preserved
                      → zero manual steps
```

## Current Flow vs App Clip Flow

| Step | Current (iOS) | With App Clip |
|------|---------------|---------------|
| Trigger | Deep link fallback to web | Smart App Banner → App Clip Card |
| Install required | Yes (App Store) | No (instant launch) |
| Attribution | **Lost** — manual 6-digit code | **Deterministic** — invocation URL |
| Identity merge | After install + code entry | Inside the App Clip, immediately |
| Auth | After full app install | WebAuthn/Passkeys in App Clip |
| Time to first interaction | Minutes | ~2 seconds |
| Full app first launch | Re-enter code, re-authenticate | Already logged in via shared Keychain |

## Credential Sharing: App Clip → Full App

This is the critical piece. Passkeys make it nearly free.

### What Transfers Automatically

**Passkeys are domain-bound, not app-bound.** They're stored in iCloud Keychain and scoped to the Relying Party ID (`frak.id`). As long as both the App Clip and the full app declare `webcredentials:frak.id` in their Associated Domains, they share the same Passkey pool.

```
User creates Passkey in App Clip (bound to frak.id)
    → User installs full Tauri app (same webcredentials:frak.id)
    → Full app calls navigator.credentials.get()
    → iOS shows the SAME Passkey (from iCloud Keychain)
    → User taps Face ID → Backend recognizes credentialId → Session established
```

### What Doesn't Transfer (And Why It's Fine)

| Data | Storage | Transfers? | Impact |
|------|---------|------------|--------|
| Passkey private key | iCloud Keychain | Yes | Core auth works seamlessly |
| Credential ID + wallet | Backend DB | Yes (server-side) | Backend recognizes the user |
| IndexedDB (`authenticatorStorage`) | App Clip sandbox | **No** — deleted on replacement | Rebuilt from backend on login |
| localStorage (Zustand stores) | App Clip sandbox | **No** — deleted on replacement | Rehydrated from backend response |

The Passkey persists **indefinitely** in iCloud Keychain — even if the App Clip is purged after 30 days of inactivity.

### Optional: Zero-Tap First Launch

For a completely seamless experience, the App Clip can write a session token to a **shared Keychain Access Group**. The full app reads it on first launch and injects it into the WKWebView — no biometric prompt needed.

## Technical Requirements

### AASA File Update

The `apple-app-site-association` file (served from `services/backend/src/api/common/wellKnown.ts`) needs the App Clip bundle ID:

```json
{
    "webcredentials": {
        "apps": [
            "TEAMID.id.frak.wallet",
            "TEAMID.id.frak.wallet.Clip"
        ]
    },
    "applinks": {
        "details": [
            {
                "appIDs": [
                    "TEAMID.id.frak.wallet",
                    "TEAMID.id.frak.wallet.Clip"
                ],
                "paths": ["/open/*"]
            }
        ]
    }
}
```

### App Clip Entitlements

Mirror the full app's Associated Domains:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>webcredentials:frak.id</string>
    <string>applinks:wallet.frak.id</string>
</array>
```

### Smart App Banner Meta Tag

Add to merchant sites (or inject via the SDK):

```html
<meta
    name="apple-itunes-app"
    content="app-id=APP_ID, app-clip-bundle-id=id.frak.wallet.Clip, app-clip-display=card"
/>
```

### Tauri Compatibility

Tauri 2.x does not have first-class App Clip support. The approach:

1. **Persist the Xcode project** — set `projectPath` in Tauri config to prevent regeneration
2. **Add the App Clip target manually** in Xcode (File → New → Target → App Clip)
3. **Build as pure SwiftUI** — don't try to run Tauri/WebView inside the App Clip
4. **Share entitlements** — same Keychain Access Group and App Group between targets

The App Clip is a ~3MB native SwiftUI target. The full Tauri app remains unchanged.

## What About the Modal Flow?

The iframe modal (login → transaction → sharing) is **not** a good App Clip candidate. It already works without any install on all platforms. Making it an App Clip would add friction (context switch out of the browser) for no gain.

The App Clip replaces only the **install/ensure flow**. The modal stays as the in-page web experience.

## What About Widgets?

Widgets (WidgetKit) are **strictly post-install retention tools**. They cannot help with user acquisition from the web.

Where they add value after the app is installed:

| Widget | Use Case |
|--------|----------|
| Lock Screen (circular) | Reward progress — "83% to next payout" |
| Home Screen (medium) | Token balance + recent rewards |
| Interactive (iOS 17+) | "Claim Reward" button without opening the app |
| Live Activity | Started from App Clip — "Tracking reward..." on Lock Screen/Dynamic Island |

The **Live Activity** angle is the most interesting: the App Clip can start one during the install flow, keeping Frak visible on the Lock Screen for up to 8 hours while the user decides whether to install the full app.

## Implementation Priority

| Priority | Item | Why | Effort |
|----------|------|-----|--------|
| **P0** | App Clip for install/ensure flow | Eliminates 6-digit code, deterministic attribution, ~20-30% conversion lift | Medium |
| **P1** | Smart App Banner on wallet.frak.id | Low-effort prerequisite — triggers the App Clip Card | Low |
| **P1** | AASA file update | Add App Clip bundle ID to webcredentials + applinks | Low |
| **P2** | Live Activity from App Clip | "Reward tracking" on Lock Screen post-merchant-purchase | Medium |
| **P3** | Home/Lock Screen widgets | Retention — balance and reward glanceables | Lower priority |

## Size Constraints

| Limit | Value | Our App | Notes |
|-------|-------|---------|-------|
| Standard App Clip | 15MB | 6-7MB (full app) | Well under — ~3MB for stripped install flow |
| URL-invoked (iOS 17+) | 50MB | 6-7MB | Massive headroom |
| App Clip lifespan | ~30 days inactive | N/A | Passkeys persist in Keychain regardless |
| Live Activity duration | Up to 8 hours | N/A | Enough for transaction confirmation |

## Key Files

| File | Role |
|------|------|
| `apps/wallet/app/routes/install.tsx` | Current web install page (to be replaced by App Clip) |
| `services/backend/src/api/common/wellKnown.ts` | Serves AASA file — needs App Clip bundle ID |
| `apps/wallet/src-tauri/gen/apple/app_iOS/app_iOS.entitlements` | Current iOS entitlements (webcredentials, applinks) |
| `packages/wallet-shared/src/common/storage/authenticators.ts` | IndexedDB authenticator storage (won't transfer — that's fine) |
| `packages/app-essentials/src/webauthn/index.ts` | RP ID and Origin config (`frak.id`) |
| `sdk/core/src/utils/deepLinkWithFallback.ts` | Current deep link fallback (would trigger App Clip instead) |
