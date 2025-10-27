# Technical Debt & Architecture Audit Report

**Date**: 2025-10-24
**Codebase**: Frak Wallet Monorepo
**Branch**: `tech/cleanup-stores`
**Commit**: `855e8b83`

---

## Executive Summary

This comprehensive audit analyzed **~50,000 lines of code** across the entire monorepo:
- **408 wallet files** (~15,117 LOC)
- **270 dashboard files** (~27,000 LOC)
- **4 SDK packages** (published to npm)
- **5 shared packages** (workspace-only)
- **Backend with 9 domains** (~12,800 LOC)
- **Hybrid AWS/GCP infrastructure** (1,429 LOC)

**Overall Grade: C+ (Functional but needs architectural refactoring)**

### Critical Findings

1. ⚠️ **"wallet-shared" God Package** - Undocumented 100+ file package mixing UI, business logic, stores, and infrastructure
2. ⚠️ **Backend DDD Confusion** - "common" directory violates domain boundaries, cross-domain dependencies
3. ⚠️ **Dashboard Architecture** - Admin dashboard 80% incomplete, Next.js overhead without SSR benefits
4. ⚠️ **Infrastructure Duplication** - Wallet deployed on both AWS and GCP
5. ⚠️ **Zero Unit Tests** - Wallet app has excellent E2E but no unit test coverage

---

## Audit Results by Area

### 1. Wallet App (`apps/wallet/`)

**Grade: B+ (Strong foundation with critical gaps)**

#### Strengths ✅
- Excellent module-based architecture (14 feature modules)
- WebAuthn + ERC-4337 Account Abstraction is production-ready
- Comprehensive E2E Playwright tests (19 specs)
- Zero cognitive complexity warnings (well-decomposed code)
- Good TanStack Query configuration with persistence
- Clean CSS Modules approach (60 files)

#### Critical Issues 🔴
- **Service Worker Size**: 97KB (target: <50KB) - Dexie is too heavy for SW-only operations
- **Entry Bundle Size**: 518KB - no lazy loading, no code splitting
- **Zero Unit Tests**: Only E2E coverage, no unit tests for hooks, stores, utilities
- **No Error Tracking**: No Sentry integration, raw error stacks shown in production
- **State Management Split**: Stores divided between `apps/wallet` (1 store) and `packages/wallet-shared` (4 stores)

#### Metrics
- **Files**: 154 TypeScript files
- **Components**: 70 components with index.tsx pattern
- **Routes**: 22 route files
- **CSS Modules**: 60 files (~1,174 lines)
- **Dependencies**: 53 total, 14 workspace packages
- **Build Output**: 2.1MB client, 518KB entry bundle

#### Immediate Actions
1. Replace Dexie in service worker with idb-keyval (reduce from 97KB to <20KB)
2. Implement route-based lazy loading (target: <300KB entry bundle)
3. Add Vitest and achieve 40% unit test coverage
4. Integrate Sentry error tracking
5. Consolidate all stores to single location

---

### 2. Dashboard Applications

**Grade: C (Needs architectural decision)**

#### Dashboard (`apps/dashboard/` - Next.js 15)
- **Size**: 270 files, 820MB .next build
- **Purpose**: Business dashboard for campaign management
- **Features**: Campaign creation, analytics, product minting, push notifications, team management

#### Dashboard Admin (`apps/dashboard-admin/` - React Router v7)
- **Size**: 77 files, ~5MB static build
- **Purpose**: Internal health monitoring
- **Status**: 80% incomplete (3/5 views are stubs)

#### Strengths ✅
- Dashboard has comprehensive features
- Type-safe API client via Elysia Eden Treaty
- Good Zustand store patterns with "use client" directives
- Smart TanStack Query persistence

#### Critical Issues 🔴
- **Framework Mismatch**: Next.js used without SSR benefits (820MB overhead)
- **Admin Incomplete**: Only 2/5 views implemented
- **Component Duplication**: Two incompatible UI systems (CSS Modules vs Tailwind)
- **MongoDB in Frontend**: Direct database access in Next.js server actions
- **Tight Backend Coupling**: Shared `iron-session` cookies with backend

#### Decision Required
**Should dashboard-admin be:**
- **Option A**: Completed (3 stub views need implementation)
- **Option B**: Merged into main dashboard
- **Option C**: Deprecated and removed

**Recommendation**: Extract admin as standalone repo (3-5 day effort) OR merge health monitoring into main dashboard.

---

### 3. SDK Packages (`sdk/`)

**Grade: B (Good foundation with fixable issues)**

#### Published Packages
- `@frak-labs/core-sdk@0.1.0` - Core SDK functionality
- `@frak-labs/react-sdk@0.1.0` - React hooks and providers
- `@frak-labs/components@0.0.23` - Web Components
- `@frak-labs/frame-connector@0.1.0` - RPC layer
- `@frak-labs/nexus-sdk@0.0.41` - Legacy compatibility

#### Strengths ✅
- Modern build system (rslib) with excellent DX
- Triple output (UMD, ESM, CJS) for maximum compatibility
- CDN bundles for `<script>` tag usage
- Proper peer dependencies (no framework bundling)
- Tree-shaking enabled (`sideEffects: false`)
- Changesets versioning with linked packages

#### Critical Issues 🔴
1. **React SDK Type Resolution Error**: Node16 module resolution fails
   - Fix: Enable `dts.bundle: true` in rslib.config.ts
   - Impact: Blocks TypeScript users with Node16/NodeNext

2. **Legacy Package Runtime Errors**: Imports private `@frak-labs/ui` package
   - Not bundled into UMD, causes "module not found" errors
   - Fix: Bundle utilities or copy inline

3. **Components Not Linked**: `@frak-labs/components` missing from Changesets linked array
   - Causes version drift (currently v0.0.23 while others are v0.1.0)

4. **Source Files Published**: `/src` directory in core-sdk npm package
   - Security risk: source code exposed
   - Size impact: Larger package download

5. **Zero Test Coverage**: No unit or integration tests

#### Bundle Sizes
- Core CDN: 108KB (33.5KB gzipped) ✅
- Components CDN: 168KB (code-split) ✅
- Legacy UMD: 91.7KB (28KB gzipped)

---

### 4. Shared Packages (`packages/`)

**Grade: D+ (Architectural debt)**

#### Current Structure
```
packages/
├── wallet-shared/        ⚠️ GOD PACKAGE (not in docs)
├── ui/                   Component library
├── app-essentials/       Blockchain + WebAuthn
├── client/               API client
├── dev-tooling/         Build configs
├── rpc/                 Published as frame-connector
└── browserslist-config/ Browser targets
```

#### Critical Issues 🔴

##### Issue 1: `wallet-shared` God Package
- **108 import locations** across wallet and listener apps
- Contains: UI components, business logic, Zustand stores, database models, analytics, i18n, hooks, providers
- **Not documented** in CLAUDE.md
- Violates Single Responsibility Principle
- Creates tight coupling

**What's inside**:
```
wallet-shared/src/
├── authentication/       # Auth logic
├── blockchain/          # Blockchain providers
├── common/
│   ├── component/       # UI components
│   ├── storage/         # Dexie IndexedDB
│   ├── analytics/       # OpenPanel
│   └── utils/
├── stores/              # 4 Zustand stores (missing "use client")
├── wallet/              # Wallet business logic
├── tokens/              # Token management
├── interaction/         # Interaction processing
├── recovery/            # Recovery flows
├── pairing/             # Device pairing
├── i18n/                # Internationalization
├── providers/           # React providers
└── sdk/                 # SDK utilities
```

##### Issue 2: Component Duplication
- `AlertDialog` exists in BOTH `packages/ui` and `packages/wallet-shared`
- Different implementations, different styling
- Violates DRY principle

##### Issue 3: `app-essentials` Mixed Concerns
- **Blockchain utilities** (ABIs, addresses, transports)
- **WebAuthn configuration** (RP ID, origin)
- **Indexer types** (campaigns, interactions)
- **Generic utils** (currency, environment)

These are orthogonal concerns that should be separate packages.

##### Issue 4: Backend Type Coupling
```typescript
// packages/client/src/server/backendClient.ts
import type { App } from "@frak-labs/backend-elysia";

export const backendApi = treaty<App>(baseUrl);
```

**Problem**: Frontend packages have dev dependency on backend, creating tight coupling.

##### Issue 5: Missing "use client" Directives
- Dashboard requires "use client" for Zustand stores
- `wallet-shared/src/stores/*.ts` don't have the directive
- Causes Next.js build issues

##### Issue 6: BigInt Polyfill Duplication
Same polyfill in 3 locations:
1. `/packages/wallet-shared/src/blockchain/provider.ts`
2. `/packages/wallet-shared/src/blockchain/aa-provider.ts`
3. `/apps/dashboard/src/polyfill/bigint-serialization.ts`

---

### 5. Backend (`services/backend/`)

**Grade: C+ (Transitional DDD)**

#### Current Structure
```
backend/src/
├── domain/           # 9 domains, 70 files
│   ├── 6degrees/
│   ├── airtable/
│   ├── auth/
│   ├── business/
│   ├── interactions/
│   ├── notifications/
│   ├── oracle/
│   ├── pairing/
│   └── wallet/
├── api/              # BFF pattern
│   ├── business/     # Dashboard API
│   ├── wallet/       # Wallet API
│   ├── external/     # Webhooks
│   └── common/
├── common/           # ⚠️ ANTI-PATTERN
├── jobs/             # Scheduled tasks
└── utils/
```

#### Strengths ✅
- Domain context pattern (composition roots)
- BFF API layer (consumer-specific APIs)
- Type-safe clients via Elysia Eden Treaty
- Schema co-location with domains
- Transaction management (Drizzle)
- LRU caching in hot paths

#### Critical DDD Violations 🔴

##### Violation 1: "Common" as Pseudo-Domain
**Problem**: Mixes infrastructure, domain concepts, and utilities
```typescript
// common/index.ts exports:
- db                            # Infrastructure
- viemClient                    # Infrastructure
- getMongoDb                    # Infrastructure
- adminWalletsRepository        # Infrastructure
- interactionDiamondRepository  # Infrastructure
- pricingRepository             # Infrastructure
- RolesRepository               # ⚠️ DOMAIN CONCEPT
- JWT services                  # Infrastructure
- Logger                        # Infrastructure
```

**Impact**: 20+ domain files import from `@backend-common`, violating domain autonomy.

##### Violation 2: Cross-Domain Dependencies
```typescript
// domain/pairing/context.ts
export namespace PairingContext {
    const connectionRepository = new PairingConnectionRepository(
        AuthContext.services.walletSdkSession  // ⚠️ Direct coupling
    );
}
```

**Proper DDD**: Use domain events or anti-corruption layers.

##### Violation 3: Integrations as Domains
- `6degrees/` - External API integration (should be in `infrastructure/integrations/`)
- `airtable/` - Third-party service (should be adapter)

##### Violation 4: Centralized Database Client
```typescript
// common/services/postgres.ts
export const db = drizzle({
    schema: {
        fixedRoutingTable,       // 6degrees
        pendingInteractionsTable, // interactions
        pushTokensTable,         // notifications
        productOracleTable,      // oracle
        pairingTable,            // pairing
    },
});
```

**Problem**: All domains visible to all, breaks encapsulation.

#### Database Strategy
- **PostgreSQL**: Transactional data (interactions, purchases, pairing)
- **MongoDB**: Authenticators (WebAuthn credentials)

**Issue**: No documentation on why two databases. Operational complexity.

#### API Consumers
1. **Dashboard** → `/business` API (SIWE auth, iron-session cookies)
2. **Wallet** → `/wallet` API (custom JWT headers)
3. **Listener** → `/wallet` API (custom JWT headers)
4. **SDK** → `/wallet` API (SDK session tokens)
5. **Webhooks** → `/ext` API (HMAC signatures)

#### Frontend Coupling
- **Dashboard shares `iron-session` cookies** with backend
- **Encryption key** shared via `SESSION_ENCRYPTION_KEY` env var
- **Session format** hardcoded in both places

---

### 6. Infrastructure (`infra/`)

**Grade: B (Good architecture, needs documentation)**

#### Multi-Cloud Strategy

**AWS (SST v3)**: Frontend applications
- Wallet, Dashboard, Dashboard Admin, Examples
- CloudFront CDN, Lambda@Edge
- ~$40-100/month

**GCP (Pulumi + K8s)**: Backend services
- Backend API (Elysia.js)
- Containerized services
- HPA, health checks
- ~$180-260/month (staging + prod)

**Rationale**: Valid separation - AWS for static/SSR, GCP for 24/7 API (more cost-effective than Lambda)

#### Issues 🔴

1. **Duplicate Wallet Deployment**: Deployed on BOTH AWS (`wallet.frak.id`) and GCP (`wallet.gcp.frak.id`)
   - TODO comment suggests GCP is experimental
   - Decision needed: Migrate or deprecate

2. **Missing Observability**: Prometheus metrics commented out in backend

3. **Zero Documentation**: No README in `/infra/` directory

4. **5 Deploy Commands**:
   - `bun deploy` (AWS dev)
   - `bun deploy:prod` (AWS prod)
   - `bun deploy:example` (AWS examples)
   - `bun deploy-gcp:staging` (GCP staging)
   - `bun deploy-gcp:prod` (GCP production)

5. **Inconsistent Stage Naming**: `dev` vs `gcp-staging`

---

## Prioritized Action Plan

### Sprint 1 (Week 1-2): Critical Fixes 🔴

**Estimated: 5-7 days**

#### Priority 1: Unblock Development
1. ✅ **Add Sentry to wallet app** (1 day)
   - Integrate error tracking
   - Replace root ErrorBoundary raw stack traces
   - Add retry mechanisms

2. ✅ **Fix React SDK type resolution** (2 hours)
   - File: `/sdk/react/rslib.config.ts`
   - Change: `dts.bundle: false` → `dts.bundle: true`
   - Test: Run `bunx @arethetypeswrong/cli`

3. ✅ **Add "use client" to wallet-shared stores** (2 hours)
   - Files: `/packages/wallet-shared/src/stores/*.ts`
   - Add `"use client";` directive to all 4 store files

4. ✅ **Remove duplicate AlertDialog** (2 hours)
   - Keep: `packages/ui/component/AlertDialog/`
   - Remove: `packages/wallet-shared/src/common/component/AlertDialog/`
   - Update imports in wallet-shared

5. ✅ **Fix service worker size** (1 day)
   - File: `/apps/wallet/app/service-worker.ts`
   - Replace Dexie with idb-keyval for notifications
   - Target: <50KB (currently 97KB)

#### Priority 2: Clarify Architecture
6. ✅ **Document wallet-shared** (1 hour)
   - Add to CLAUDE.md under "Monorepo Structure"
   - Mark as technical debt

7. ✅ **Create /infra/README.md** (2 hours)
   - Document multi-cloud rationale
   - List all deployment commands
   - Explain stage naming

8. ✅ **Decide dashboard-admin fate** (meeting + 2 days)
   - Option A: Complete 3 stub views
   - Option B: Merge into main dashboard
   - Option C: Deprecate

9. ✅ **Decide wallet deployment** (1 day)
   - AWS vs GCP wallet
   - Remove duplicate

---

### Sprint 2 (Week 3-4): Backend DDD Refactoring 🟠

**Estimated: 7-9 days**

#### Priority 3: Fix Backend Architecture

10. ✅ **Refactor `common/` → `infrastructure/`** (3 days)

    **Step 1**: Create new structure
    ```
    backend/src/
    ├── infrastructure/
    │   ├── persistence/
    │   │   ├── postgres.ts      (from common/services/postgres.ts)
    │   │   └── mongodb.ts       (from common/services/db.ts)
    │   ├── blockchain/
    │   │   └── client.ts        (from common/services/blockchain.ts)
    │   ├── keys/
    │   │   └── AdminWalletsRepository.ts
    │   ├── pricing/
    │   │   └── PricingRepository.ts
    │   └── integrations/
    │       ├── sixdegrees/      (move from domain/6degrees/)
    │       └── airtable/        (move from domain/airtable/)
    ```

    **Step 2**: Move `RolesRepository` to auth domain
    ```
    backend/src/domain/auth/
    ├── repositories/
    │   └── RolesRepository.ts   (from common/)
    ```

    **Step 3**: Update all imports (use find-replace)

11. ✅ **Implement domain events** (2 days)

    **Create event system**:
    ```typescript
    // src/infrastructure/events/DomainEvent.ts
    export interface DomainEvent {
        eventId: string;
        eventType: string;
        occurredAt: Date;
        aggregateId: string;
    }

    // src/infrastructure/events/EventBus.ts
    export class EventBus {
        private handlers: Map<string, Array<(event: DomainEvent) => Promise<void>>>;

        async publish(event: DomainEvent): Promise<void> {
            const handlers = this.handlers.get(event.eventType) || [];
            await Promise.all(handlers.map(h => h(event)));
        }

        subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>) {
            // ...
        }
    }
    ```

    **Replace cross-domain imports**:
    ```typescript
    // Before: domain/pairing/context.ts
    const connectionRepository = new PairingConnectionRepository(
        AuthContext.services.walletSdkSession  // ❌ Direct coupling
    );

    // After
    eventBus.subscribe("WalletAuthenticated", async (event) => {
        // Handle in pairing domain
    });
    ```

12. ✅ **Add backend unit tests** (2 days)
    - Target: 40% coverage on domain services
    - Use Bun test runner (already configured)
    - Repository tests with test containers
    - Focus: Recovery, authentication, campaign rewards

---

### Sprint 3 (Week 5-6): Shared Packages Refactoring 🟡

**Estimated: 7-8 days**

#### Priority 4: Split wallet-shared

13. ✅ **Split into focused packages** (5 days)

    **Create new package structure**:
    ```
    packages/
    ├── wallet-domain/           # Business logic
    │   ├── authentication/
    │   ├── wallet/
    │   ├── tokens/
    │   ├── interaction/
    │   └── recovery/
    │
    ├── wallet-ui/              # UI components
    │   ├── pairing/
    │   └── common/
    │
    ├── wallet-stores/          # State management (with "use client")
    │   ├── sessionStore.ts
    │   ├── userStore.ts
    │   ├── walletStore.ts
    │   ├── authenticationStore.ts
    │   └── recoveryStore.ts    (move from apps/wallet)
    │
    └── wallet-infra/           # Infrastructure
        ├── storage/            # Dexie
        ├── analytics/          # OpenPanel
        ├── providers/          # React providers
        └── i18n/               # Internationalization
    ```

    **Migration strategy**:
    - Create all 4 new packages with package.json
    - Move files incrementally
    - Update imports using find-replace
    - Keep `wallet-shared` temporarily with re-exports
    - Remove `wallet-shared` once migration complete

14. ✅ **Decouple client from backend** (2 days)

    **Option A**: OpenAPI approach
    ```typescript
    // Backend generates OpenAPI spec
    bun run generate:openapi

    // Client generates types from spec
    bun run generate:client-types
    ```

    **Option B**: Contract package (recommended)
    ```
    packages/
    └── api-contracts/
        ├── backend/
        │   ├── business.ts      # Business API DTOs
        │   └── wallet.ts        # Wallet API DTOs
        └── indexer/
            └── types.ts         # Indexer types
    ```

    Remove `@frak-labs/backend-elysia` from frontend dev dependencies.

15. ✅ **Consolidate BigInt polyfill** (1 hour)
    ```
    packages/
    └── polyfills/
        └── bigint-serialization.ts
    ```

    Import in app entry points only:
    - `apps/wallet/app/entry.client.tsx`
    - `apps/dashboard/src/app/layout.tsx`
    - `apps/listener/app/entry.client.tsx`

---

### Sprint 4 (Week 7-8): Performance & Quality 📈

**Estimated: 8-9 days**

#### Priority 5: Wallet App Improvements

16. ✅ **Implement lazy loading** (2 days)
    ```typescript
    // apps/wallet/app/views/
    import { lazy, Suspense } from "react";

    const WalletView = lazy(() => import("./protected/wallet"));
    const HistoryView = lazy(() => import("./protected/history"));
    const TokensView = lazy(() => import("./protected/tokens"));
    const SettingsView = lazy(() => import("./protected/settings"));

    export function ProtectedLayout() {
        return (
            <Suspense fallback={<LoadingSpinner />}>
                {/* routes */}
            </Suspense>
        );
    }
    ```
    Target: <300KB entry bundle (currently 518KB)

17. ✅ **Add Vitest + unit tests** (3 days)
    ```bash
    cd apps/wallet
    bun add -D vitest @vitest/ui
    ```

    Test priorities:
    - Recovery encryption/decryption hooks
    - Smart wallet operations
    - Authentication hooks
    - Zustand stores
    - Utility functions

    Target: 40% coverage

18. ✅ **Add integration tests** (2 days)
    - Service worker messaging
    - IndexedDB operations
    - API client flows
    - WebAuthn flows (with mocks)

#### Priority 6: Infrastructure

19. ✅ **Enable Prometheus metrics** (1 day)
    ```typescript
    // services/backend/src/index.ts
    import { prometheus } from "@elysiajs/prometheus";

    const app = new Elysia()
        .use(prometheus())
        // ...
    ```

    Uncomment ServiceMonitor in `/infra/gcp/backend.ts:139`

20. ✅ **Add deployment rollback strategy** (1 day)
    - Document in `/infra/README.md`
    - Add rollback scripts
    - Test rollback procedure

21. ✅ **Document secrets** (2 hours)
    Create `/infra/SECRETS.md` listing:
    - All 25+ environment variables
    - Where they're stored (SST secrets, GCP secrets)
    - How to rotate them

---

## Proposed Architecture (After Refactoring)

### Package Structure

```
frak-wallet/
├── apps/
│   ├── wallet/              # React Router SSR-disabled PWA
│   ├── dashboard/           # Next.js business dashboard
│   └── listener/            # Listener app
│
├── packages/                # Internal workspace packages
│   ├── ui/                  # Generic UI components (no app-specific code)
│   ├── blockchain/          # Blockchain infrastructure (was app-essentials)
│   ├── webauthn/            # WebAuthn domain
│   ├── shared-types/        # Common types
│   ├── api-contracts/       # API DTOs (no backend import)
│   ├── api-client/          # Generic API client
│   ├── dev-tooling/         # Build configs
│   ├── polyfills/           # Runtime polyfills
│   │
│   # Wallet-specific packages
│   ├── wallet-domain/       # Wallet business logic
│   ├── wallet-ui/           # Wallet-specific components
│   ├── wallet-stores/       # Wallet state (with "use client")
│   └── wallet-infra/        # Wallet infrastructure
│
├── sdk/                     # Published packages
│   ├── core/
│   ├── react/
│   ├── components/
│   ├── frame-connector/     # (moved from packages/rpc)
│   └── legacy/
│
├── services/
│   └── backend/
│       ├── domain/
│       │   ├── authentication/
│       │   ├── authorization/      # (new, from common RolesRepository)
│       │   ├── wallet/
│       │   ├── campaigns/          # (split from interactions)
│       │   ├── interactions/       # (user actions only)
│       │   ├── purchases/          # (split from oracle)
│       │   └── notifications/
│       ├── infrastructure/
│       │   ├── persistence/
│       │   │   ├── postgres.ts
│       │   │   └── mongodb.ts
│       │   ├── blockchain/
│       │   │   └── client.ts
│       │   ├── keys/
│       │   │   └── AdminWalletsRepository.ts
│       │   ├── pricing/
│       │   │   └── PricingRepository.ts
│       │   ├── messaging/
│       │   │   └── EventBus.ts
│       │   └── integrations/
│       │       ├── sixdegrees/
│       │       ├── airtable/
│       │       ├── shopify/
│       │       └── woocommerce/
│       └── api/
│           ├── business/           # Dashboard API
│           ├── wallet/             # Wallet/Listener/SDK API
│           └── external/           # Webhooks
│
└── infra/
    ├── aws/                 # SST resources
    ├── gcp/                 # Pulumi resources
    ├── components/          # Reusable IaC
    ├── README.md            # 🆕 Architecture docs
    └── SECRETS.md           # 🆕 Secret inventory
```

---

## Metrics & Success Criteria

### Before Refactoring
- **Shared packages**: 5 (mixed concerns)
- **wallet-shared imports**: 108 locations (tight coupling)
- **Backend "common" exports**: 17 (god object)
- **Wallet bundle**: 518KB (no lazy loading)
- **Service worker**: 97KB (Dexie overhead)
- **Unit test coverage**: 0% wallet, ~10% backend
- **SDK type errors**: React SDK fails Node16 resolution
- **Infrastructure docs**: 0 lines
- **Cross-domain dependencies**: 3+ direct imports

### After Refactoring (Target)
- **Shared packages**: 12 (clear boundaries)
- **Focused package imports**: <30 per app (loose coupling)
- **Backend infrastructure**: Dependency injection (no global)
- **Wallet bundle**: <300KB (lazy loaded routes)
- **Service worker**: <50KB (idb-keyval)
- **Unit test coverage**: 40% wallet, 60% backend
- **SDK type errors**: 0 (all packages pass attw)
- **Infrastructure docs**: 500+ lines (comprehensive)
- **Domain events**: Proper event-driven architecture

---

## Risk Assessment & Mitigation

### Risk 1: Breaking Changes During Refactoring
**Impact**: High
**Probability**: Medium

**Mitigation**:
- Feature freeze during Sprint 2-3 (backend refactoring)
- Comprehensive E2E tests before starting
- Incremental migration (old + new packages coexist)
- Thorough manual testing after each sprint

### Risk 2: Team Bandwidth
**Impact**: Medium
**Probability**: High

**Mitigation**:
- Prioritize Sprint 1 (critical fixes) - can be done in 1 week
- Defer Sprints 3-4 if needed (less critical)
- Consider external consultant for infrastructure docs
- Parallelize work across 2-3 team members

### Risk 3: Deployment Downtime
**Impact**: High
**Probability**: Low

**Mitigation**:
- Blue-green deployment for backend
- Feature flags for gradual rollout
- Rollback plan documented
- Deploy during low-traffic hours

### Risk 4: Type Safety Loss
**Impact**: Medium
**Probability**: Medium (when decoupling client from backend)

**Mitigation**:
- Use OpenAPI spec generation + validation
- Add runtime validation (Zod) for API responses
- Comprehensive integration tests
- Version API contracts

---

## Effort Estimation & ROI

### Total Effort: 30-35 working days (6-7 weeks)

### Team Allocation Options

#### Option A: Sequential (1 person)
- **Duration**: 8 weeks @ 1 FTE
- **Risk**: Long feedback loop, context switching
- **Best for**: Small team, can't spare multiple people

#### Option B: Parallel (2 people) ⭐ RECOMMENDED
- **Duration**: 4 weeks @ 2 FTE
- **Person 1**: Backend DDD + Infrastructure (Sprints 2, 4)
- **Person 2**: Wallet app + Shared packages (Sprints 1, 3)
- **Best for**: Balanced approach, manageable merge conflicts

#### Option C: Aggressive (3 people)
- **Duration**: 3 weeks @ 3 FTE
- **Person 1**: Backend refactoring (Sprint 2)
- **Person 2**: Wallet + SDK fixes (Sprints 1, 4)
- **Person 3**: Shared packages split (Sprint 3)
- **Risk**: High merge conflicts, coordination overhead

### ROI Breakdown

#### Immediate Benefits (Sprint 1)
- ✅ Unblocked Next.js dashboard builds
- ✅ Error visibility (Sentry)
- ✅ SDK usable by TypeScript consumers
- ✅ Smaller service worker (faster PWA install)
- ✅ Fixed component duplication

**Value**: High developer productivity, better UX

#### Medium-Term Benefits (Sprint 2-3)
- ✅ Clear domain boundaries (easier feature development)
- ✅ Reduced coupling (parallel team development)
- ✅ Proper DDD (scalable architecture)
- ✅ Test coverage (confidence in refactoring)
- ✅ Maintainable shared packages

**Value**: 30-40% faster feature development

#### Long-Term Benefits (Post-refactoring)
- ✅ Reduced onboarding time (clear boundaries)
- ✅ Lower bug rate (better testing)
- ✅ Easier to extract services (microservices-ready)
- ✅ Better code quality (maintainability)
- ✅ Scalable architecture

**Value**: Sustained velocity, easier scaling

---

## Recommendations Beyond Tech Debt

### 1. Adopt Architectural Decision Records (ADRs)
Create `docs/adr/` directory and document:
- **ADR-001**: Why two databases (Postgres + MongoDB)?
- **ADR-002**: Why two cloud providers (AWS + GCP)?
- **ADR-003**: Why two frameworks (Next.js + React Router)?
- **ADR-004**: Domain boundaries and bounded contexts
- **ADR-005**: API versioning strategy

### 2. Implement Dependency Constraints
Use ESLint `@nx/enforce-module-boundaries` or similar:
```typescript
// .eslintrc.json
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "allow": [],
        "depConstraints": [
          {
            "sourceTag": "scope:frontend",
            "onlyDependOnLibsWithTags": ["scope:frontend", "scope:shared"]
          },
          {
            "sourceTag": "scope:backend",
            "onlyDependOnLibsWithTags": ["scope:backend", "scope:shared"]
          }
        ]
      }
    ]
  }
}
```

### 3. Create Architecture Guild
Monthly review of:
- New package proposals
- Domain boundary changes
- Infrastructure decisions
- API contract changes

### 4. Set Up Bundle Monitoring
Add to CI:
```yaml
# .github/workflows/ci.yml
- name: Check bundle size
  run: |
    bun run bundle:check
    # Fail if:
    # - Wallet entry > 300KB
    # - Service worker > 50KB
    # - Backend image > 500MB
```

### 5. Add Performance Budgets
```typescript
// apps/wallet/vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Enforce chunk size limits
        }
      }
    }
  }
}
```

---

## Next Steps

### 1. Schedule Team Meeting (2 hours)
- Review this audit report
- Discuss findings
- Prioritize action items
- Assign ownership
- Set timeline

### 2. Create GitHub Issues
Create issues for all Sprint 1-4 tasks:
- Label: `tech-debt`, `architecture`
- Milestone: Sprint 1, Sprint 2, etc.
- Assign to team members

### 3. Start Sprint 1 (Week 1-2)
Focus on critical fixes with immediate ROI:
- Sentry integration
- SDK type fixes
- Service worker optimization
- Store consolidation

### 4. Weekly Check-ins
- Monday: Sprint planning
- Wednesday: Mid-sprint sync
- Friday: Sprint review
- Track progress, adjust plan

---

## Conclusion

Your monorepo has **solid foundations** but suffers from **architectural drift** over time. The main issues are:

1. **Shared packages grew organically** without clear boundaries
2. **Backend started DDD** but mixed infrastructure concerns
3. **Dashboard apps** have inconsistent architecture
4. **Infrastructure** lacks documentation

The good news: These are **all fixable** with systematic refactoring. The proposed 4-sprint plan will:
- ✅ Unblock immediate development issues
- ✅ Establish clear domain boundaries
- ✅ Enable parallel team development
- ✅ Create scalable architecture

**Expected outcome**: 30-40% faster feature development, reduced onboarding time, lower bug rate, and maintainable codebase ready for growth.

---

**For detailed deep dives, see**:
- `BACKEND_DEEP_DIVE.md` - Comprehensive backend architecture guide
- `SHARED_PACKAGES_DEEP_DIVE.md` - Wallet/Listener shared packages analysis
