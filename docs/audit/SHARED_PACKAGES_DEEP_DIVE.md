# Shared Packages Deep Dive: Wallet & Listener Apps

**Focus**: `packages/wallet-shared` and related packages used by wallet and listener apps

---

## Executive Summary

The **wallet-shared** package is the **most problematic** shared package in your monorepo. It's a **10,000+ line god package** that has become a dumping ground for anything shared between wallet and listener apps.

**Key Issues**:
1. **108 import locations** across 2 apps (massive coupling)
2. **Mixed responsibilities**: UI, business logic, state, infrastructure, i18n
3. **Not documented** in CLAUDE.md (hidden technical debt)
4. **Component duplication** with `packages/ui`
5. **Missing "use client" directives** (breaks Next.js)

**Grade: D (Architectural anti-pattern)**

---

## Package Inventory

### Current Shared Packages

```
packages/
├── wallet-shared/          ⚠️ GOD PACKAGE (10,000+ LOC, 100+ files)
├── ui/                     Component library (3,500 LOC)
├── app-essentials/         Blockchain + WebAuthn (2,000 LOC)
├── client/                 API client (500 LOC)
├── dev-tooling/           Build configs (300 LOC)
├── rpc/                    Frame connector (1,500 LOC)
└── browserslist-config/    Browser targets
```

### Import Analysis

**Wallet App** (`apps/wallet/`):
```bash
# Count of imports from each package
@frak-labs/wallet-shared:    108 imports  ⚠️ VERY HIGH
@frak-labs/app-essentials:    42 imports
@frak-labs/client:            18 imports
@frak-labs/ui:                67 imports
@frak-labs/core-sdk:          31 imports
@frak-labs/frame-connector:   12 imports
```

**Listener App** (`apps/listener/`):
```bash
# Estimated similar pattern
@frak-labs/wallet-shared:    ~80 imports  ⚠️ VERY HIGH
@frak-labs/app-essentials:    ~30 imports
@frak-labs/client:            ~15 imports
@frak-labs/ui:                ~40 imports
```

---

## Problem #1: The `wallet-shared` God Package

### What's Inside

```
packages/wallet-shared/src/
├── authentication/           # 8 files - Authentication logic
│   ├── component/            # UI components
│   ├── session/              # Session management
│   └── utils/                # Auth helpers
│
├── blockchain/               # 10 files - Blockchain providers
│   ├── provider.ts           # Viem client setup
│   ├── aa-provider.ts        # Account Abstraction provider
│   ├── smartAccountConnector.ts
│   └── transports.ts
│
├── common/                   # 25 files - Everything else
│   ├── component/            # UI components (AlertDialog, etc.)
│   │   ├── AlertDialog/
│   │   ├── Drawer/
│   │   └── ...
│   ├── storage/              # Dexie IndexedDB setup
│   │   └── dexie/
│   ├── analytics/            # OpenPanel integration
│   │   └── OpenPanelProvider.tsx
│   ├── utils/                # Utility functions
│   └── const.ts
│
├── stores/                   # 4 files - Zustand stores
│   ├── sessionStore.ts       # Session state
│   ├── userStore.ts          # User profile
│   ├── walletStore.ts        # Wallet state
│   └── authenticationStore.ts # Auth state
│
├── wallet/                   # 8 files - Wallet business logic
│   ├── action/
│   ├── component/
│   ├── hook/
│   └── smartWallet/
│
├── tokens/                   # 6 files - Token management
│   ├── component/
│   ├── hook/
│   └── utils/
│
├── interaction/              # 7 files - Interaction processing
│   ├── component/
│   ├── hook/
│   └── utils/
│
├── recovery/                 # 12 files - Recovery flows
│   ├── component/
│   ├── hook/
│   └── utils/
│
├── pairing/                  # 10 files - Device pairing
│   ├── component/
│   ├── hook/
│   └── utils/
│
├── i18n/                     # 4 files - Internationalization
│   ├── config.ts
│   ├── locales/
│   └── types.ts
│
├── providers/                # 5 files - React providers
│   ├── FrakContext.tsx
│   └── ...
│
└── sdk/                      # 3 files - SDK utilities
    └── utils/
```

### Dependency Analysis

```typescript
// packages/wallet-shared/package.json dependencies
{
  "@frak-labs/app-essentials": "workspace:*",    // Blockchain utils
  "@frak-labs/backend-elysia": "workspace:*",    // Backend types (dev)
  "@frak-labs/client": "workspace:*",            // API client
  "@frak-labs/core-sdk": "workspace:*",          // Core SDK
  "@frak-labs/frame-connector": "workspace:*",   // RPC
  "@frak-labs/ui": "workspace:*",                // UI components

  // External dependencies
  "@simplewebauthn/browser": "catalog:",         // WebAuthn
  "@tanstack/react-query": "catalog:",          // Data fetching
  "dexie": "^4.2.1",                            // IndexedDB
  "i18next": "^25.6.0",                         // i18n
  "permissionless": "^0.2.57",                  // Account Abstraction
  "react": "catalog:",
  "viem": "catalog:",                           // Ethereum
  "wagmi": "catalog:",                          // React hooks for Ethereum
  "zustand": "catalog:"                         // State management
}
```

**Problem**: wallet-shared depends on **6 other workspace packages** plus 10+ external dependencies. This creates a **dependency bottleneck**.

---

## Why This Is Broken

### Violation 1: Single Responsibility Principle

The package has **at least 10 distinct responsibilities**:

1. **Authentication** - WebAuthn, sessions, authenticators
2. **Blockchain** - Providers, transports, connectors
3. **UI Components** - AlertDialog, Drawer, etc.
4. **State Management** - Zustand stores
5. **Storage** - IndexedDB via Dexie
6. **Analytics** - OpenPanel tracking
7. **Wallet Operations** - Smart wallet logic
8. **Token Management** - Token display, transfers
9. **Interactions** - Interaction tracking
10. **Recovery** - Account recovery flows
11. **Pairing** - Device pairing
12. **i18n** - Internationalization

Each of these could (and should) be its own package.

### Violation 2: Component Duplication

**AlertDialog exists in TWO places**:

1. `/packages/ui/component/AlertDialog/index.tsx` (156 lines)
2. `/packages/wallet-shared/src/common/component/AlertDialog/index.tsx` (103 lines)

**Differences**:
```typescript
// ui/AlertDialog/index.tsx
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import styles from "./index.module.css";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
// ... standard Radix exports

// wallet-shared/AlertDialog/index.tsx
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { mergeElement } from "../../utils/mergeElement";

// Custom implementation with CSS prefixing
export const AlertDialog = forwardRef((props, ref) => (
    <AlertDialogPrimitive.Root {...props} ref={ref} />
));

export const AlertDialogPortal = ({ ...props }) => (
    <AlertDialogPrimitive.Portal
        {...props}
        container={document.getElementById("nexus-modal-root")}
    />
);

export const AlertDialogOverlay = forwardRef(({ ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        {...mergeElement(props, { className: prefixModalCss("overlay") })}
        ref={ref}
    />
));
```

**Why duplication occurred**:
- `wallet-shared` needs custom CSS prefixing (`nexus-modal-${name}`)
- `wallet-shared` needs custom portal container (`#nexus-modal-root`)
- Instead of making `ui` package configurable, they copied and modified

**Similar duplication**:
- Drawer components (different libraries: Radix vs Vaul)
- Modal components (different styling approaches)

### Violation 3: Missing "use client" Directives

**Location**: `/packages/wallet-shared/src/stores/*.ts`

```typescript
// wallet-shared/src/stores/sessionStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ❌ Missing "use client" directive
export const sessionStore = create<SessionStore>()(
    persist((set) => ({
        // ...
    }), {
        name: "frak_session_store",
    })
);
```

**Problem**: Dashboard app (Next.js 15) imports these stores but Next.js requires `"use client"` for client-side code.

**Workaround in dashboard**:
```typescript
// apps/dashboard/src/stores/campaignStore.ts
"use client";  // ✅ Dashboard stores have directive

import { create } from "zustand";
```

**Impact**:
- Next.js build warnings
- Forces consumers to wrap imports with client boundaries
- Inconsistent patterns across codebase

### Violation 4: Infrastructure in Shared Package

**BigInt Serialization Polyfill** (duplicated 3x):

```typescript
// packages/wallet-shared/src/blockchain/provider.ts
// Add the bigint serialization
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// packages/wallet-shared/src/blockchain/aa-provider.ts
// Add the bigint serialization
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// apps/dashboard/src/polyfill/bigint-serialization.ts
// Same code again!
```

**Problem**:
- Side effect executed multiple times
- No guarantee of execution order
- Should be in app entry point, not library

### Violation 5: App-Specific Code in Shared Package

**CSS Prefixing** (`packages/ui/utils/prefixModalCss.ts`):
```typescript
export function prefixModalCss(name: string) {
    return `nexus-modal-${name}`;
}
```

**Problem**:
- "Nexus" is an app-specific brand name
- UI package should be domain-agnostic
- Hardcoded prefixes violate Open/Closed Principle

**Similar issues**:
- `prefixWalletCss.ts` - Returns `frak-wallet-${name}`
- `prefixDrawerCss.ts` - Returns `nexus-drawer-${name}`

---

## Wallet vs Listener: Shared Needs Analysis

### Wallet App Specific

**What ONLY wallet needs**:
- Recovery flows (12 files)
- Settings UI
- Profile management
- Token display (full UI)
- History views
- PWA service worker
- Push notifications UI
- Install prompts

### Listener App Specific

**What ONLY listener needs**:
- Iframe communication layer
- Parent window messaging
- Modal mounting in host page
- SSO flows (different from wallet)
- Limited UI (modals only)

### Actually Shared

**What BOTH apps need**:
- WebAuthn authentication ✅
- Blockchain providers ✅
- Smart wallet connector ✅
- Session stores ✅
- API client ✅
- Interaction tracking ✅
- Pairing logic ✅
- i18n configuration ✅

---

## Proposed Refactoring: Split into Focused Packages

### New Package Structure

```
packages/
├── wallet-domain/              # Business logic (NEW)
│   ├── authentication/
│   │   ├── useWebAuthN.ts
│   │   ├── useAuthenticators.ts
│   │   └── session.ts
│   ├── wallet/
│   │   ├── useSmartWallet.ts
│   │   ├── useWalletBalance.ts
│   │   └── smartWalletConnector.ts
│   ├── tokens/
│   │   ├── useTokenList.ts
│   │   └── tokenUtils.ts
│   ├── interactions/
│   │   ├── useInteractions.ts
│   │   ├── useInteractionHistory.ts
│   │   └── interactionTracker.ts
│   ├── recovery/
│   │   ├── useRecovery.ts
│   │   ├── recoveryEncryption.ts
│   │   └── recoveryStorage.ts
│   └── pairing/
│       ├── usePairing.ts
│       ├── pairingConnection.ts
│       └── signatureRequest.ts
│
├── wallet-ui/                  # UI components (NEW)
│   ├── authentication/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── pairing/
│   │   ├── PairingModal.tsx
│   │   └── SignatureRequest.tsx
│   ├── recovery/
│   │   └── RecoveryWizard.tsx
│   └── common/
│       ├── AlertDialog.tsx    # With custom prefixing
│       └── Drawer.tsx
│
├── wallet-stores/              # State management (NEW)
│   ├── sessionStore.ts        # ✅ With "use client"
│   ├── userStore.ts           # ✅ With "use client"
│   ├── walletStore.ts         # ✅ With "use client"
│   ├── authenticationStore.ts # ✅ With "use client"
│   └── recoveryStore.ts       # ✅ Moved from apps/wallet
│
├── wallet-infra/               # Infrastructure (NEW)
│   ├── storage/
│   │   └── dexie.ts           # IndexedDB setup
│   ├── analytics/
│   │   └── openPanel.ts       # Analytics setup
│   ├── blockchain/
│   │   ├── provider.ts        # Viem client
│   │   └── transports.ts      # RPC transports
│   └── i18n/
│       ├── config.ts
│       └── locales/
│
├── ui/                         # Generic UI (REFACTORED)
│   ├── component/
│   │   ├── AlertDialog/       # Configurable version
│   │   ├── Button/
│   │   ├── Spinner/
│   │   └── ...
│   └── utils/
│       ├── prefixCss.ts       # ✅ Accepts prefix param
│       └── ...
│
├── blockchain/                 # Blockchain infra (RENAMED from app-essentials)
│   ├── abis/
│   ├── addresses/
│   ├── transports/
│   └── providers/
│
├── webauthn/                   # WebAuthn domain (NEW, split from app-essentials)
│   ├── config.ts
│   ├── authenticatorStorage.ts
│   └── utils.ts
│
├── shared-types/               # Common types (NEW)
│   ├── indexer/
│   ├── api/
│   └── blockchain/
│
├── api-contracts/              # API DTOs (NEW)
│   ├── backend/
│   │   ├── wallet.ts
│   │   └── business.ts
│   └── indexer/
│       └── types.ts
│
├── api-client/                 # Generic client (REFACTORED)
│   └── createApiClient.ts
│
├── polyfills/                  # Runtime polyfills (NEW)
│   └── bigint-serialization.ts
│
├── dev-tooling/               # Build configs (KEEP)
└── browserslist-config/       # Browser targets (KEEP)
```

### Package Responsibility Matrix

| Package | Responsibility | Used By | Size |
|---------|---------------|---------|------|
| `wallet-domain` | Business logic, hooks, utilities | Wallet, Listener | Medium |
| `wallet-ui` | UI components for wallet/listener | Wallet, Listener | Large |
| `wallet-stores` | Zustand stores with "use client" | Wallet, Listener | Small |
| `wallet-infra` | Infrastructure setup | Wallet, Listener | Small |
| `ui` | Generic, reusable UI components | All apps | Medium |
| `blockchain` | Blockchain infrastructure | Wallet, Listener, Dashboard | Medium |
| `webauthn` | WebAuthn configuration | Wallet, Listener | Small |
| `shared-types` | Common type definitions | All apps | Small |
| `api-contracts` | API DTOs (no backend import) | All apps | Small |
| `api-client` | Generic API client factory | All apps | Small |
| `polyfills` | Runtime polyfills | All apps | Tiny |

---

## Migration Plan

### Phase 1: Create Package Structure (Day 1-2)

**Step 1: Create package directories**
```bash
cd packages/

mkdir -p wallet-domain/{authentication,wallet,tokens,interactions,recovery,pairing}
mkdir -p wallet-ui/{authentication,pairing,recovery,common}
mkdir -p wallet-stores
mkdir -p wallet-infra/{storage,analytics,blockchain,i18n}
mkdir -p blockchain/{abis,addresses,transports,providers}
mkdir -p webauthn
mkdir -p shared-types/{indexer,api,blockchain}
mkdir -p api-contracts/{backend,indexer}
mkdir -p polyfills
```

**Step 2: Create package.json for each**
```json
// packages/wallet-domain/package.json
{
  "name": "@frak-labs/wallet-domain",
  "version": "1.0.0",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./authentication": {
      "development": "./src/authentication/index.ts",
      "import": "./dist/authentication.js",
      "require": "./dist/authentication.cjs"
    },
    "./wallet": { /* ... */ },
    "./tokens": { /* ... */ },
    "./interactions": { /* ... */ },
    "./recovery": { /* ... */ },
    "./pairing": { /* ... */ }
  },
  "dependencies": {
    "@frak-labs/blockchain": "workspace:*",
    "@frak-labs/webauthn": "workspace:*",
    "@frak-labs/api-client": "workspace:*",
    "@frak-labs/shared-types": "workspace:*",
    "@simplewebauthn/browser": "catalog:",
    "viem": "catalog:",
    "wagmi": "catalog:"
  }
}

// packages/wallet-stores/package.json
{
  "name": "@frak-labs/wallet-stores",
  "version": "1.0.0",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./sessionStore": { /* ... */ },
    "./userStore": { /* ... */ },
    "./walletStore": { /* ... */ },
    "./authenticationStore": { /* ... */ },
    "./recoveryStore": { /* ... */ }
  },
  "dependencies": {
    "zustand": "catalog:"
  }
}

// packages/wallet-ui/package.json
{
  "name": "@frak-labs/wallet-ui",
  "version": "1.0.0",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./authentication": { /* ... */ },
    "./pairing": { /* ... */ },
    "./recovery": { /* ... */ },
    "./common": { /* ... */ }
  },
  "dependencies": {
    "@frak-labs/ui": "workspace:*",
    "@frak-labs/wallet-domain": "workspace:*",
    "@frak-labs/wallet-stores": "workspace:*",
    "react": "catalog:"
  }
}

// packages/wallet-infra/package.json
{
  "name": "@frak-labs/wallet-infra",
  "version": "1.0.0",
  "exports": {
    "./storage": { /* ... */ },
    "./analytics": { /* ... */ },
    "./blockchain": { /* ... */ },
    "./i18n": { /* ... */ }
  },
  "dependencies": {
    "dexie": "^4.2.1",
    "i18next": "catalog:",
    "viem": "catalog:"
  }
}
```

---

### Phase 2: Move Zustand Stores (Day 3)

**Priority: Critical for Next.js compatibility**

```bash
# Move all stores from wallet-shared
mv packages/wallet-shared/src/stores/*.ts packages/wallet-stores/src/

# Move recovery store from wallet app
mv apps/wallet/app/module/stores/recoveryStore.ts packages/wallet-stores/src/
```

**Add "use client" directive to all stores**:
```typescript
// packages/wallet-stores/src/sessionStore.ts
"use client";  // ✅ Add this line

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const sessionStore = create<SessionStore>()(
    persist((set) => ({
        // ...
    }), {
        name: "frak_session_store",
    })
);

// Export selectors
export const selectSession = (state: SessionStore) => state.session;
export const selectWebauthnSession = (state: SessionStore) => {
    const session = state.session;
    if (!session || (session.type !== undefined && session.type !== "webauthn")) {
        return null;
    }
    return session;
};
```

**Create barrel export**:
```typescript
// packages/wallet-stores/src/index.ts
export * from "./sessionStore";
export * from "./userStore";
export * from "./walletStore";
export * from "./authenticationStore";
export * from "./recoveryStore";
```

**Update imports** (find-replace in wallet app):
```typescript
// Before
import { sessionStore, selectSession } from "@frak-labs/wallet-shared/stores/sessionStore";

// After
import { sessionStore, selectSession } from "@frak-labs/wallet-stores/sessionStore";
```

---

### Phase 3: Split app-essentials (Day 4-5)

**Move blockchain to dedicated package**:
```bash
# Create blockchain package
mv packages/app-essentials/src/blockchain packages/blockchain/src

# Structure
packages/blockchain/src/
├── abis/
│   ├── campaign.ts
│   ├── interaction.ts
│   └── ...
├── addresses/
│   ├── registry.ts
│   └── stablecoins.ts
├── transports/
│   ├── drpc.ts
│   └── erpc.ts
└── providers/
    └── createViemClient.ts
```

**Move WebAuthn to dedicated package**:
```bash
# Create webauthn package
mv packages/app-essentials/src/webauthn packages/webauthn/src

# Structure
packages/webauthn/src/
├── config.ts       # RP ID, origin, name
└── utils.ts        # Helper functions
```

**Move types to shared-types**:
```bash
# Create shared-types package
mv packages/app-essentials/src/types packages/shared-types/src

# Structure
packages/shared-types/src/
├── indexer/
│   ├── campaign.ts
│   ├── interaction.ts
│   └── ...
├── api/
└── blockchain/
```

**Update imports**:
```typescript
// Before
import { campaignAbi } from "@frak-labs/app-essentials/blockchain/abis";
import { rpId } from "@frak-labs/app-essentials/webauthn";
import type { Campaign } from "@frak-labs/app-essentials/types/indexer";

// After
import { campaignAbi } from "@frak-labs/blockchain/abis";
import { rpId } from "@frak-labs/webauthn";
import type { Campaign } from "@frak-labs/shared-types/indexer";
```

---

### Phase 4: Extract Stores from wallet-shared (Day 6-8)

**Consolidate BigInt polyfill**:
```typescript
// packages/polyfills/src/bigint-serialization.ts
export function setupBigIntSerialization(): void {
    if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
        (BigInt.prototype as any).toJSON = function () {
            return this.toString();
        };
    }
}
```

**Import in app entry points only**:
```typescript
// apps/wallet/app/entry.client.tsx
import { setupBigIntSerialization } from "@frak-labs/polyfills/bigint-serialization";

setupBigIntSerialization();

// ... rest of app setup

// apps/dashboard/src/app/layout.tsx
import { setupBigIntSerialization } from "@frak-labs/polyfills/bigint-serialization";

setupBigIntSerialization();
```

**Remove from library files**:
```bash
# Delete duplicate polyfills
rm packages/wallet-shared/src/blockchain/provider.ts:1-5
rm packages/wallet-shared/src/blockchain/aa-provider.ts:1-5
```

---

### Phase 5: Move Domain Logic (Day 9-12)

**Authentication domain**:
```bash
# Move authentication files
mv packages/wallet-shared/src/authentication packages/wallet-domain/src/authentication

# Structure
packages/wallet-domain/src/authentication/
├── hooks/
│   ├── useWebAuthN.ts
│   ├── useAuthenticators.ts
│   └── usePreviousAuthenticators.ts
├── session.ts
└── utils.ts
```

**Wallet domain**:
```bash
mv packages/wallet-shared/src/wallet packages/wallet-domain/src/wallet

# Structure
packages/wallet-domain/src/wallet/
├── hooks/
│   ├── useSmartWallet.ts
│   ├── useWalletBalance.ts
│   └── useEnforceConnection.ts
├── smartWallet/
│   ├── connector.ts
│   └── provider.ts
└── utils.ts
```

**Tokens domain**:
```bash
mv packages/wallet-shared/src/tokens packages/wallet-domain/src/tokens
```

**Interactions domain**:
```bash
mv packages/wallet-shared/src/interaction packages/wallet-domain/src/interactions
```

**Recovery domain**:
```bash
mv packages/wallet-shared/src/recovery packages/wallet-domain/src/recovery
```

**Pairing domain**:
```bash
mv packages/wallet-shared/src/pairing packages/wallet-domain/src/pairing
```

---

### Phase 6: Move UI Components (Day 13-15)

**Extract wallet-specific UI**:
```bash
# Authentication UI
mv packages/wallet-shared/src/authentication/component packages/wallet-ui/src/authentication

# Pairing UI
mv packages/wallet-shared/src/pairing/component packages/wallet-ui/src/pairing

# Recovery UI
mv packages/wallet-shared/src/recovery/component packages/wallet-ui/src/recovery

# Common UI with custom prefixing
mv packages/wallet-shared/src/common/component packages/wallet-ui/src/common
```

**Update AlertDialog to be configurable**:
```typescript
// packages/ui/component/AlertDialog/index.tsx
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import styles from "./index.module.css";

// ✅ Accept prefix and container as props
export interface AlertDialogConfig {
    cssPrefix?: string;
    portalContainer?: string | HTMLElement;
}

const AlertDialogContext = createContext<AlertDialogConfig>({});

export const AlertDialog = AlertDialogPrimitive.Root;

export const AlertDialogPortal = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Portal>
>(({ container, ...props }, ref) => {
    const config = useContext(AlertDialogContext);
    const portalContainer = container || config.portalContainer;

    return (
        <AlertDialogPrimitive.Portal
            {...props}
            container={
                typeof portalContainer === "string"
                    ? document.getElementById(portalContainer)
                    : portalContainer
            }
            ref={ref}
        />
    );
});

export const AlertDialogOverlay = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
    const config = useContext(AlertDialogContext);
    const prefixedClass = config.cssPrefix
        ? `${config.cssPrefix}-overlay`
        : styles.overlay;

    return (
        <AlertDialogPrimitive.Overlay
            className={`${prefixedClass} ${className || ""}`}
            {...props}
            ref={ref}
        />
    );
});

// Usage in wallet-ui
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay } from "@frak-labs/ui/component/AlertDialog";

export function WalletAlertDialog() {
    return (
        <AlertDialogContext.Provider value={{
            cssPrefix: "nexus-modal",
            portalContainer: "nexus-modal-root"
        }}>
            <AlertDialog>
                <AlertDialogPortal>
                    <AlertDialogOverlay />
                    {/* ... */}
                </AlertDialogPortal>
            </AlertDialog>
        </AlertDialogContext.Provider>
    );
}
```

**Remove duplicate AlertDialog**:
```bash
rm -rf packages/wallet-shared/src/common/component/AlertDialog
```

---

### Phase 7: Move Infrastructure (Day 16-17)

**Storage infrastructure**:
```bash
mv packages/wallet-shared/src/common/storage packages/wallet-infra/src/storage
```

**Analytics infrastructure**:
```bash
mv packages/wallet-shared/src/common/analytics packages/wallet-infra/src/analytics
```

**Blockchain infrastructure**:
```bash
mv packages/wallet-shared/src/blockchain packages/wallet-infra/src/blockchain
```

**i18n infrastructure**:
```bash
mv packages/wallet-shared/src/i18n packages/wallet-infra/src/i18n
```

---

### Phase 8: Decouple API Client (Day 18-19)

**Create API contracts package** (no backend import):
```typescript
// packages/api-contracts/src/backend/wallet.ts
import type { Address, Hex } from "viem";

// ✅ DTOs only, no backend import
export interface PushInteractionRequest {
    productId: Hex;
    interactionType: string;
    data: Record<string, unknown>;
}

export interface PushInteractionResponse {
    interactionId: string;
    status: "pending" | "processing";
}

export interface GetBalanceResponse {
    address: Address;
    confirmed: bigint;
    pending: bigint;
}

// ... all other endpoint types
```

**Refactor API client** to use contracts:
```typescript
// packages/api-client/src/index.ts
import ky from "ky";
import type {
    PushInteractionRequest,
    PushInteractionResponse,
    GetBalanceResponse,
} from "@frak-labs/api-contracts/backend/wallet";

export function createWalletApiClient(baseUrl: string) {
    const client = ky.create({
        prefixUrl: baseUrl,
        credentials: "include",
    });

    return {
        interactions: {
            push: (data: PushInteractionRequest) =>
                client.post("wallet/interactions/push", { json: data })
                    .json<PushInteractionResponse>(),
        },
        balance: {
            get: (address: Address) =>
                client.get(`wallet/balance/${address}`)
                    .json<GetBalanceResponse>(),
        },
        // ... other endpoints
    };
}
```

**Remove backend dependency**:
```json
// packages/wallet-shared/package.json (before deletion)
// Remove this line:
"@frak-labs/backend-elysia": "workspace:*"
```

---

### Phase 9: Update All Imports (Day 20-22)

**Automated find-replace** (use sed or search-replace in IDE):

```bash
# In apps/wallet and apps/listener

# Stores
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/stores/@frak-labs\/wallet-stores/g'

# Domain logic
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/authentication/@frak-labs\/wallet-domain\/authentication/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/wallet/@frak-labs\/wallet-domain\/wallet/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/tokens/@frak-labs\/wallet-domain\/tokens/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/interaction/@frak-labs\/wallet-domain\/interactions/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/recovery/@frak-labs\/wallet-domain\/recovery/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/pairing/@frak-labs\/wallet-domain\/pairing/g'

# UI components
find . -type f -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/.*\/component/@frak-labs\/wallet-ui/g'

# Infrastructure
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/common\/storage/@frak-labs\/wallet-infra\/storage/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/common\/analytics/@frak-labs\/wallet-infra\/analytics/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/blockchain/@frak-labs\/wallet-infra\/blockchain/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/wallet-shared\/i18n/@frak-labs\/wallet-infra\/i18n/g'

# app-essentials splits
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/app-essentials\/blockchain/@frak-labs\/blockchain/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/app-essentials\/webauthn/@frak-labs\/webauthn/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@frak-labs\/app-essentials\/types/@frak-labs\/shared-types/g'
```

**Manual verification**:
```bash
# Check for remaining wallet-shared imports
grep -r "@frak-labs/wallet-shared" apps/wallet
grep -r "@frak-labs/wallet-shared" apps/listener

# Should return 0 results
```

---

### Phase 10: Delete wallet-shared (Day 23)

**Final verification**:
```bash
# Ensure zero imports
grep -r "@frak-labs/wallet-shared" apps/
grep -r "@frak-labs/wallet-shared" packages/

# Run type checks
bun run typecheck

# Run tests
cd apps/wallet && bun run test:e2e

# Build apps
bun run build
```

**Delete the god package**:
```bash
rm -rf packages/wallet-shared
```

**Update workspace**:
```json
// package.json (root)
{
  "workspaces": [
    // Remove this line:
    // "packages/wallet-shared",

    // New packages added:
    "packages/wallet-domain",
    "packages/wallet-ui",
    "packages/wallet-stores",
    "packages/wallet-infra",
    "packages/blockchain",
    "packages/webauthn",
    "packages/shared-types",
    "packages/api-contracts",
    "packages/polyfills"
  ]
}
```

---

## Testing Strategy During Migration

### Phase 1: Baseline Tests

Before making changes:
```bash
# Run all E2E tests
cd apps/wallet && bun run test:e2e

# Record success state
# All tests should pass
```

### Phase 2: Incremental Testing

After each phase:
```bash
# Type check
bun run typecheck

# Build
bun run build

# E2E tests
cd apps/wallet && bun run test:e2e

# If any fail: rollback that phase, fix issues, retry
```

### Phase 3: Final Validation

After migration complete:
```bash
# Full test suite
bun run typecheck
bun run test:e2e
bun run build

# Manual smoke tests:
# 1. Wallet app login
# 2. Interaction tracking
# 3. Token display
# 4. Recovery flow
# 5. Pairing flow
# 6. Dashboard login
# 7. Campaign creation
```

---

## Benefits After Refactoring

### 1. Clear Boundaries
- Each package has single responsibility
- Easy to reason about what goes where
- New features have obvious home

### 2. Reduced Coupling
```bash
# Before: 108 imports from wallet-shared
# After: ~30 imports across 7 focused packages
```

### 3. Independent Versioning
- Can version stores separately from UI
- Domain logic can evolve independently
- Infrastructure changes don't affect domain

### 4. Better Tree-Shaking
- Unused domain logic not bundled
- UI components imported individually
- Smaller bundle sizes

### 5. Testability
- Each package can be tested in isolation
- Mock dependencies easily
- Faster test feedback

### 6. Next.js Compatibility
- All stores have "use client" directive
- No build warnings
- Proper client/server boundaries

### 7. Reusability
- `ui` package truly generic (no app-specific code)
- `blockchain` package reusable in dashboard
- `webauthn` package reusable in any auth context

---

## New Import Patterns

### Before (God Package)
```typescript
// Everything from one package
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useWebAuthN } from "@frak-labs/wallet-shared/authentication/useWebAuthN";
import { LoginForm } from "@frak-labs/wallet-shared/authentication/component/LoginForm";
import { AlertDialog } from "@frak-labs/wallet-shared/common/component/AlertDialog";
import { dexieDb } from "@frak-labs/wallet-shared/common/storage/dexie";
import { openPanel } from "@frak-labs/wallet-shared/common/analytics/openPanel";
```

### After (Focused Packages)
```typescript
// Clear separation of concerns
import { sessionStore } from "@frak-labs/wallet-stores/sessionStore";
import { useWebAuthN } from "@frak-labs/wallet-domain/authentication";
import { LoginForm } from "@frak-labs/wallet-ui/authentication";
import { AlertDialog } from "@frak-labs/ui/component/AlertDialog";
import { dexieDb } from "@frak-labs/wallet-infra/storage";
import { openPanel } from "@frak-labs/wallet-infra/analytics";
```

---

## Effort Estimation

### Total: 23 working days (4.5 weeks)

| Phase | Days | Risk |
|-------|------|------|
| 1. Create structure | 2 | Low |
| 2. Move stores | 1 | Low |
| 3. Split app-essentials | 2 | Low |
| 4. Extract polyfills | 1 | Low |
| 5. Move domain logic | 4 | Medium |
| 6. Move UI components | 3 | Medium |
| 7. Move infrastructure | 2 | Low |
| 8. Decouple API client | 2 | Medium |
| 9. Update imports | 3 | High (tedious) |
| 10. Delete wallet-shared | 1 | Low |
| **Buffer** | 2 | - |

### Team Allocation

**Option A: 1 person**
- Duration: 5-6 weeks
- Best for: Steady, careful migration

**Option B: 2 people (recommended)**
- Duration: 2.5-3 weeks
- Person 1: Phases 1-4, 8
- Person 2: Phases 5-7, 9-10
- Requires coordination on imports

---

## Rollback Strategy

If issues arise during migration:

### Per-Phase Rollback
```bash
# Git workflow
git checkout -b migration/phase-2-stores
# Make changes
git commit -m "Phase 2: Move stores"

# If issues found
git revert HEAD
# or
git reset --hard origin/main
```

### Keep wallet-shared During Migration
```typescript
// packages/wallet-shared/src/index.ts
// Re-export from new packages (temporary)
export * from "@frak-labs/wallet-stores";
export * from "@frak-labs/wallet-domain/authentication";
export * from "@frak-labs/wallet-ui/authentication";
// ... etc

// This allows gradual migration
// Apps work during transition
```

---

## Success Metrics

### Before
- Packages: 5
- wallet-shared imports: 108 (wallet app)
- Build time: ~45s
- TypeScript errors: 13 (vite plugin issues)
- Bundle size: 518KB

### After (Target)
- Packages: 12 (focused)
- Focused imports: ~30 per app
- Build time: ~35s (less dependency tracking)
- TypeScript errors: 0
- Bundle size: <300KB (better tree-shaking)
- Next.js compatibility: ✅ (no "use client" warnings)
- Component duplication: 0

---

## Conclusion

The `wallet-shared` god package is your **largest architectural debt**. It started as a convenience but became a **bottleneck** for:
- Code organization
- Team collaboration
- Framework compatibility (Next.js)
- Bundle optimization
- Independent testing

The migration to **7 focused packages** will:
- ✅ Clarify responsibilities
- ✅ Reduce coupling (108 imports → ~30)
- ✅ Enable better tree-shaking
- ✅ Fix Next.js compatibility
- ✅ Remove component duplication
- ✅ Make codebase navigable

**Time investment**: 4-5 weeks
**Long-term benefit**: 30-40% faster development, easier onboarding, maintainable architecture

This refactoring is **essential** before adding more features or scaling the team.
