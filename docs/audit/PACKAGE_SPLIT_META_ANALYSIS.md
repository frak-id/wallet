# Package Split Strategy Meta-Analysis

**Date**: 2025-10-24
**Codebase**: Frak Wallet Monorepo
**Purpose**: Architecture review comparing package splitting strategies

---

## Executive Summary

This analysis compares four different strategies for addressing the "wallet-shared god package" problem in the Frak Wallet monorepo. Based on comprehensive review of the codebase structure and existing proposals, I provide pragmatic recommendations for the team.

**TLDR Recommendation**: **Strategy 3 (Progressive)** - Start with 3 critical packages, iterate to 7 over 2 sprints.

---

## The Four Strategies

### Strategy 0: Status Quo (Baseline)

**Current state - no changes**

**Package Count**: 7 packages total
- `packages/wallet-shared` (god package - 10,000+ LOC)
- `packages/ui`
- `packages/app-essentials` (mixed blockchain + WebAuthn)
- `packages/client`
- `packages/dev-tooling`
- `packages/rpc`
- `packages/browserslist-config`

**Key Metrics**:
- wallet-shared imports: 108 locations
- Lines of code in wallet-shared: 10,000+
- Responsibilities in wallet-shared: 12+ distinct domains
- Component duplication: Yes (AlertDialog)
- Next.js compatibility: No ("use client" issues)
- Backend coupling: Yes (dev dependency)

---

### Strategy 1: Original Audit Proposal (Comprehensive)

**Source**: TECHNICAL_DEBT_AUDIT.md
**Approach**: Comprehensive architectural refactoring

**Package Count**: 13 packages total

**New Structure**:
```
packages/
├── ui/                      # Generic UI (refactored)
├── blockchain/              # Blockchain infrastructure
├── webauthn/                # WebAuthn domain
├── shared-types/            # Common types
├── api-contracts/           # API DTOs (no backend import)
├── api-client/              # Generic API client
├── polyfills/               # Runtime polyfills
├── wallet-domain/           # Wallet business logic
├── wallet-ui/               # Wallet-specific UI
├── wallet-stores/           # State management (with "use client")
├── wallet-infra/            # Infrastructure (storage, analytics, i18n)
├── dev-tooling/             # Build configs
└── browserslist-config/     # Browser targets
```

**What Gets Split**:
1. **wallet-shared → 4 new packages**:
   - `wallet-domain` - Business logic, hooks
   - `wallet-ui` - UI components
   - `wallet-stores` - Zustand stores
   - `wallet-infra` - Infrastructure (Dexie, OpenPanel, i18n)

2. **app-essentials → 3 new packages**:
   - `blockchain` - Blockchain infrastructure
   - `webauthn` - WebAuthn configuration
   - `shared-types` - Common types

3. **client → 2 new packages**:
   - `api-client` - Generic client factory
   - `api-contracts` - API DTOs (decoupled from backend)

4. **New packages**:
   - `polyfills` - Consolidate BigInt serialization

**Benefits**:
- ✅ Clear domain boundaries
- ✅ Zero component duplication
- ✅ Full Next.js compatibility
- ✅ Backend decoupling
- ✅ Maximum tree-shaking potential
- ✅ Independent testing per package
- ✅ Reusable across all apps

**Drawbacks**:
- ⚠️ High complexity (13 packages)
- ⚠️ Steep learning curve for new developers
- ⚠️ 108+ import statement updates
- ⚠️ 4-5 week effort
- ⚠️ High risk of breaking changes

---

### Strategy 2: Conservative Approach (Minimal)

**Approach**: Fix critical issues only, minimal disruption

**Package Count**: 9 packages total

**Changes**:
```
packages/
├── ui/                      # Keep as-is
├── blockchain/              # NEW - Split from app-essentials
├── webauthn/                # NEW - Split from app-essentials
├── client/                  # Keep as-is (fix backend import)
├── wallet-shared/           # REFACTOR (not split)
│   ├── domain/              # Reorganize internally
│   ├── ui/
│   ├── stores/              # Add "use client" directives
│   └── infra/
├── dev-tooling/             # Keep as-is
├── rpc/                     # Keep as-is
└── browserslist-config/     # Keep as-is
```

**What Changes**:
1. **Split app-essentials only** (critical for reusability):
   - `blockchain` - Needed by dashboard
   - `webauthn` - Clear domain separation

2. **Fix wallet-shared internally**:
   - Add "use client" to all stores
   - Reorganize folders (domain/, ui/, stores/, infra/)
   - Remove duplicate AlertDialog
   - Consolidate BigInt polyfill
   - Fix backend coupling in client package

3. **Documentation**:
   - Document wallet-shared structure in CLAUDE.md
   - Add package responsibility matrix

**Benefits**:
- ✅ Quick wins (1-2 weeks)
- ✅ Low risk
- ✅ Fixes Next.js compatibility
- ✅ Fixes component duplication
- ✅ Solves dashboard reusability
- ✅ Minimal import changes (~30 locations)

**Drawbacks**:
- ⚠️ wallet-shared still large (but organized)
- ⚠️ Limited tree-shaking improvement
- ⚠️ Defers architectural debt
- ⚠️ Some coupling remains

---

### Strategy 3: Progressive Approach (Incremental)

**Approach**: Start small, iterate based on learnings

**Package Count**: 10 packages total → 12 packages (2 sprints)

**Sprint 1 (Week 1-2)**: Critical Extractions
```
packages/
├── ui/                      # Refactor to be configurable
├── blockchain/              # NEW - From app-essentials
├── webauthn/                # NEW - From app-essentials
├── wallet-stores/           # NEW - From wallet-shared (critical!)
├── client/                  # Fix backend coupling
├── wallet-shared/           # REDUCED (keep temporarily)
│   ├── domain/              # Business logic
│   ├── ui/                  # UI components
│   └── infra/               # Infrastructure
├── dev-tooling/
├── rpc/
└── browserslist-config/
```

**Sprint 2 (Week 3-4)**: Domain Separation
```
packages/
├── ui/
├── blockchain/
├── webauthn/
├── wallet-stores/
├── wallet-domain/           # NEW - From wallet-shared
├── wallet-ui/               # NEW - From wallet-shared
├── wallet-infra/            # NEW - From wallet-shared
├── polyfills/               # NEW - Consolidate polyfills
├── client/
├── dev-tooling/
├── rpc/
└── browserslist-config/

# DELETE wallet-shared at end of Sprint 2
```

**Migration Path**:

**Phase 1: Immediate Wins** (1 week)
1. Extract `wallet-stores` (fixes Next.js)
2. Split `app-essentials` → `blockchain` + `webauthn`
3. Fix AlertDialog duplication
4. Add "use client" directives
5. ~40 import updates

**Phase 2: Domain Extraction** (1-2 weeks)
1. Extract `wallet-domain` (business logic)
2. Extract `wallet-ui` (components)
3. Extract `wallet-infra` (storage, analytics)
4. Create `polyfills` package
5. Delete `wallet-shared`
6. ~80 import updates

**Benefits**:
- ✅ Quick initial wins (fixes Next.js in week 1)
- ✅ Learn from Phase 1 before Phase 2
- ✅ Can pause after Phase 1 if needed
- ✅ Moderate risk (split over 2 sprints)
- ✅ Good balance of speed vs. quality
- ✅ Team can work in parallel after Phase 1

**Drawbacks**:
- ⚠️ Temporary state with wallet-shared still present
- ⚠️ Two rounds of import updates
- ⚠️ Requires discipline to complete Phase 2

---

### Strategy 4: Radical Approach (Over-engineering)

**Approach**: Maximum granularity

**Package Count**: 20+ packages

**Theoretical Structure**:
```
packages/
├── ui/
├── ui-primitives/           # Radix wrappers
├── ui-modals/               # Modal components
├── ui-forms/                # Form components
├── blockchain-core/
├── blockchain-abis/
├── blockchain-addresses/
├── blockchain-transports/
├── webauthn/
├── wallet-auth/             # Authentication domain
├── wallet-operations/       # Wallet operations
├── wallet-tokens/           # Token management
├── wallet-recovery/         # Recovery flows
├── wallet-pairing/          # Pairing flows
├── wallet-interactions/     # Interaction tracking
├── wallet-stores-session/   # Session store only
├── wallet-stores-user/      # User store only
├── wallet-stores-wallet/    # Wallet store only
├── wallet-ui-auth/
├── wallet-ui-recovery/
├── wallet-ui-pairing/
├── wallet-infra-storage/
├── wallet-infra-analytics/
├── wallet-infra-i18n/
├── polyfills/
└── ... (30+ packages total)
```

**Benefits**:
- ✅ Maximum isolation
- ✅ Granular versioning
- ✅ Ultimate tree-shaking

**Drawbacks**:
- ⚠️ Extreme complexity
- ⚠️ Decision paralysis (which package?)
- ⚠️ Dependency graph nightmare
- ⚠️ Impossible to maintain
- ⚠️ 2-3 month effort
- ⚠️ High risk of abandonment

**Verdict**: ❌ **Over-engineering - Do not pursue**

---

## Scoring Matrix

| Criteria | Weight | Strategy 0 (Status Quo) | Strategy 1 (Comprehensive) | Strategy 2 (Conservative) | Strategy 3 (Progressive) |
|----------|--------|-------------------------|---------------------------|---------------------------|--------------------------|
| **Complexity Score** (1-10, lower is better) | 25% | 2/10 ⚠️ | 8/10 ⚠️ | 3/10 ✅ | 5/10 ✅ |
| **Maintainability Score** (1-10) | 30% | 2/10 ⚠️ | 9/10 ✅ | 6/10 ✅ | 8/10 ✅ |
| **Problem-Solving Score** (1-10) | 25% | 1/10 ⚠️ | 10/10 ✅ | 6/10 ✅ | 9/10 ✅ |
| **Effort Score** (1-10, lower is better) | 20% | 0/10 ✅ | 9/10 ⚠️ | 3/10 ✅ | 5/10 ✅ |
| **WEIGHTED TOTAL** | 100% | **1.9/10** | **8.8/10** | **5.7/10** | **7.9/10** |

### Detailed Scoring

#### Complexity Score (1-10, lower is better)

**Strategy 0: 2/10** ⚠️
- Current state is simple (1 god package)
- But hidden complexity is very high
- Hard to understand what belongs where
- Implicit dependencies everywhere

**Strategy 1: 8/10** ⚠️
- 13 packages to understand
- Complex dependency graph
- Decision overhead: "which package?"
- Requires architecture training
- New developers need extensive onboarding

**Strategy 2: 3/10** ✅
- Only 2 new packages (blockchain, webauthn)
- wallet-shared stays (but organized)
- Minimal learning curve
- Easy to understand for existing team

**Strategy 3: 5/10** ✅
- Phase 1: 3 new packages (manageable)
- Phase 2: 7 new packages total
- Incremental learning curve
- Team builds understanding gradually

---

#### Maintainability Score (1-10)

**Strategy 0: 2/10** ⚠️
- God package is unmaintainable
- Component duplication will worsen
- Next.js compatibility breaks
- Technical debt accumulates
- Parallel development is difficult

**Strategy 1: 9/10** ✅
- Clear boundaries for features
- Independent versioning per domain
- Easy to add new features (obvious home)
- Test in isolation
- Zero duplication
- Great tree-shaking

**Strategy 2: 6/10** ✅
- Organized wallet-shared is better
- Still some cognitive load
- Limited tree-shaking
- Can add features easily
- Some testing isolation

**Strategy 3: 8/10** ✅
- Most benefits of Strategy 1
- Slightly less granular (wallet-ui vs wallet-ui-auth, etc.)
- Excellent feature development
- Good testing isolation
- Minimal duplication

---

#### Problem-Solving Score (1-10)

**Does it solve the critical issues?**

**Critical Issues**:
1. ❌ wallet-shared god package (108 imports)
2. ❌ Component duplication (AlertDialog)
3. ❌ Missing "use client" directives
4. ❌ Backend coupling in client
5. ❌ app-essentials mixed concerns
6. ❌ Poor tree-shaking
7. ❌ Next.js incompatibility

**Strategy 0: 1/10** ⚠️
- Solves: Nothing
- ❌ All 7 issues remain

**Strategy 1: 10/10** ✅
- Solves: All issues
- ✅ wallet-shared eliminated
- ✅ Zero duplication
- ✅ "use client" directives
- ✅ Backend decoupled
- ✅ app-essentials split
- ✅ Maximum tree-shaking
- ✅ Full Next.js support

**Strategy 2: 6/10** ✅
- Solves: 4 of 7 issues
- ⚠️ wallet-shared still large (but organized)
- ✅ Zero duplication
- ✅ "use client" directives
- ⚠️ Backend partially decoupled
- ✅ app-essentials split
- ⚠️ Limited tree-shaking
- ✅ Next.js compatible

**Strategy 3: 9/10** ✅
- Solves: 6.5 of 7 issues
- ✅ wallet-shared eliminated (by end)
- ✅ Zero duplication
- ✅ "use client" directives
- ✅ Backend decoupled
- ✅ app-essentials split
- ✅ Good tree-shaking (90% of Strategy 1)
- ✅ Full Next.js support

---

#### Effort Score (1-10, lower is better)

**Strategy 0: 0/10** ✅
- Zero effort (no changes)

**Strategy 1: 9/10** ⚠️
- **Files to move**: 100+ files
- **Import updates**: 108+ locations
- **New packages**: 6 new packages
- **Risk**: High (all at once)
- **Duration**: 4-5 weeks
- **Team**: 2 people recommended
- **Testing**: Comprehensive needed

**Strategy 2: 3/10** ✅
- **Files to move**: 20-30 files
- **Import updates**: 30-40 locations
- **New packages**: 2 new packages
- **Risk**: Low (minimal changes)
- **Duration**: 1-2 weeks
- **Team**: 1 person can do it
- **Testing**: Light testing needed

**Strategy 3: 5/10** ✅
- **Files to move**: 60-80 files
- **Import updates**: 120 locations (2 phases)
- **New packages**: 7 new packages
- **Risk**: Medium (phased approach reduces risk)
- **Duration**: 2-3 weeks (2 sprints)
- **Team**: 1-2 people
- **Testing**: Incremental testing

---

## Comprehensive Comparison

### Strategy Pros & Cons

#### Strategy 0: Status Quo

**Pros**:
- ✅ No effort required
- ✅ No risk of breaking changes
- ✅ Team already familiar

**Cons**:
- ❌ All critical issues remain
- ❌ Technical debt accumulates
- ❌ Next.js compatibility broken
- ❌ Component duplication worsens
- ❌ Parallel development difficult
- ❌ New features have no clear home
- ❌ Cannot scale team effectively

**Verdict**: ❌ **Not viable long-term**

---

#### Strategy 1: Comprehensive

**Pros**:
- ✅ Solves all 7 critical issues
- ✅ Clean architecture (textbook DDD)
- ✅ Maximum maintainability
- ✅ Best tree-shaking potential
- ✅ Independent versioning
- ✅ Easiest to add new features
- ✅ Great for scaling team (>5 devs)

**Cons**:
- ❌ High complexity (13 packages)
- ❌ Long duration (4-5 weeks)
- ❌ High risk (all at once)
- ❌ Requires 2+ people
- ❌ Learning curve for team
- ❌ Decision overhead ("which package?")
- ❌ May be over-engineered for current team size

**Best For**:
- Large teams (5+ developers)
- Long-term investment (>2 year horizon)
- Multiple apps depending on packages
- When architecture is top priority

**Verdict**: ⭐ **Ideal end state, but risky to execute all at once**

---

#### Strategy 2: Conservative

**Pros**:
- ✅ Quick wins (1-2 weeks)
- ✅ Low risk (minimal changes)
- ✅ Fixes critical Next.js issues
- ✅ Solves component duplication
- ✅ 1 person can execute
- ✅ Easy to understand
- ✅ Can be done immediately

**Cons**:
- ⚠️ wallet-shared still large (organized but not split)
- ⚠️ Limited tree-shaking benefits
- ⚠️ Defers architectural debt
- ⚠️ Will need future refactoring
- ⚠️ Some coupling remains
- ⚠️ Not a long-term solution

**Best For**:
- Small teams (1-3 developers)
- Short-term focus (next 6 months)
- When bandwidth is limited
- Need quick fixes to unblock development

**Verdict**: ⚠️ **Band-aid solution - buys time but doesn't solve root cause**

---

#### Strategy 3: Progressive (RECOMMENDED)

**Pros**:
- ✅ Solves 6.5 of 7 issues
- ✅ Quick initial wins (Week 1 fixes Next.js)
- ✅ Moderate risk (phased approach)
- ✅ Learn from Phase 1 before Phase 2
- ✅ Can pause after Phase 1 if needed
- ✅ Good architecture (90% of Strategy 1 benefits)
- ✅ Reasonable duration (2-3 weeks)
- ✅ 1-2 people can execute
- ✅ Achievable in 2 sprints

**Cons**:
- ⚠️ Two rounds of import updates
- ⚠️ Temporary state with wallet-shared
- ⚠️ Requires discipline to complete Phase 2
- ⚠️ Slightly less granular than Strategy 1

**Best For**:
- Medium teams (2-4 developers)
- Medium-term focus (6-18 months)
- Pragmatic approach to tech debt
- Want balance of speed and quality
- Need measurable progress quickly

**Verdict**: ⭐⭐⭐ **RECOMMENDED - Best balance of risk, effort, and benefits**

---

## Detailed Recommendation: Strategy 3 (Progressive)

### Why Strategy 3?

1. **Pragmatic Balance**:
   - Not too conservative (fixes root causes)
   - Not too aggressive (manageable scope)
   - Achievable in 1-2 month sprint

2. **Risk Mitigation**:
   - Phase 1 (Week 1-2): Low-risk, high-value changes
   - Pause point: Can stop after Phase 1 if issues arise
   - Phase 2 (Week 3-4): Learn from Phase 1 experience

3. **Immediate Value**:
   - Week 1: Next.js compatibility fixed
   - Week 1: Component duplication removed
   - Week 1: app-essentials split (dashboard can reuse)
   - Week 2-4: Full architectural benefits

4. **Team Velocity**:
   - Doesn't block feature development
   - Can work on features after Phase 1
   - Phase 2 can be done by 1 person

### What We Get

**After Phase 1 (Week 1-2)**:
- ✅ Next.js compatibility (critical!)
- ✅ Zero component duplication
- ✅ blockchain/webauthn packages reusable
- ✅ wallet-stores extracted (with "use client")
- ⚠️ wallet-shared still present (but reduced)

**After Phase 2 (Week 3-4)**:
- ✅ wallet-shared deleted
- ✅ 7 focused packages
- ✅ 90% of Strategy 1 benefits
- ✅ Clean architecture
- ✅ Good tree-shaking

### What We Defer

**Compared to Strategy 1**:
- Deferred: `shared-types` package (keep types in domain packages)
- Deferred: `api-contracts` package (keep in client for now)
- Deferred: Granular domain splits (wallet-auth, wallet-recovery separate)

**Rationale**:
- These can be extracted later if needed
- YAGNI principle (You Aren't Gonna Need It)
- Avoids premature optimization

### What We Give Up

**Compared to Strategy 1**:
- Less granular package structure
  - Strategy 3: `wallet-domain` (all business logic)
  - Strategy 1: `wallet-auth`, `wallet-operations`, `wallet-tokens`, etc.

- No backend decoupling via contracts
  - Strategy 3: Keep Elysia Eden Treaty
  - Strategy 1: OpenAPI or contracts package

**Why This Is OK**:
- Current team size (2-4 devs) doesn't need granularity
- Elysia Eden Treaty provides type safety
- Can split wallet-domain later if needed
- 80/20 rule: 80% of benefits, 20% of complexity

---

## Migration Timeline

### Sprint 1 - Phase 1: Critical Extractions

**Week 1-2: 10 working days**

**Day 1-2: Setup & Stores**
- [ ] Create 3 new package directories
  - `packages/wallet-stores/`
  - `packages/blockchain/`
  - `packages/webauthn/`
- [ ] Create package.json for each
- [ ] Extract all stores from wallet-shared
- [ ] Move recovery store from apps/wallet
- [ ] Add "use client" to all 5 stores
- [ ] Update ~15 import locations

**Day 3-4: Split app-essentials**
- [ ] Move blockchain code to packages/blockchain
- [ ] Move WebAuthn code to packages/webauthn
- [ ] Update ~25 import locations
- [ ] Test blockchain functionality
- [ ] Test WebAuthn flows

**Day 5: UI Cleanup**
- [ ] Make ui/AlertDialog configurable
- [ ] Remove duplicate AlertDialog from wallet-shared
- [ ] Update ~10 import locations
- [ ] Test modal rendering

**Day 6-7: Testing & Validation**
- [ ] Run full typecheck: `bun run typecheck`
- [ ] Run E2E tests: `cd apps/wallet && bun run test:e2e`
- [ ] Manual smoke tests (login, pairing, interactions)
- [ ] Build all apps: `bun run build`
- [ ] Deploy to dev environment
- [ ] Monitor for issues

**Day 8-10: Buffer & Documentation**
- [ ] Fix any issues found in testing
- [ ] Update CLAUDE.md with new packages
- [ ] Document Phase 2 plan
- [ ] Create GitHub issues for Phase 2

**Pause Point**: Team can stop here if needed. Critical issues are solved.

---

### Sprint 2 - Phase 2: Domain Extraction

**Week 3-4: 10 working days**

**Day 1-2: Extract wallet-domain**
- [ ] Create packages/wallet-domain/
- [ ] Move authentication logic
- [ ] Move wallet operations
- [ ] Move token management
- [ ] Move interactions tracking
- [ ] Move recovery logic
- [ ] Move pairing logic
- [ ] Update ~40 import locations

**Day 3-4: Extract wallet-ui**
- [ ] Create packages/wallet-ui/
- [ ] Move authentication UI
- [ ] Move pairing UI
- [ ] Move recovery UI
- [ ] Move common UI (with prefixing)
- [ ] Update ~25 import locations

**Day 5-6: Extract wallet-infra**
- [ ] Create packages/wallet-infra/
- [ ] Move Dexie storage setup
- [ ] Move OpenPanel analytics
- [ ] Move blockchain providers
- [ ] Move i18n configuration
- [ ] Update ~15 import locations

**Day 7: Polyfills & Cleanup**
- [ ] Create packages/polyfills/
- [ ] Consolidate BigInt serialization
- [ ] Remove duplicate polyfills
- [ ] Update app entry points

**Day 8: Delete wallet-shared**
- [ ] Verify zero imports of wallet-shared
- [ ] Delete packages/wallet-shared/
- [ ] Update workspace configuration
- [ ] Update CLAUDE.md

**Day 9-10: Testing & Release**
- [ ] Run full typecheck
- [ ] Run all E2E tests
- [ ] Manual smoke tests (all features)
- [ ] Build all apps
- [ ] Deploy to dev environment
- [ ] Monitor for 2-3 days
- [ ] Deploy to production

---

## Success Criteria

### Phase 1 Success (Week 1-2)

**Must Have**:
- [ ] All E2E tests pass
- [ ] Zero TypeScript errors
- [ ] All apps build successfully
- [ ] Next.js dashboard builds without warnings
- [ ] No component duplication
- [ ] wallet-stores has "use client" directives
- [ ] blockchain package works in dashboard
- [ ] webauthn package works in wallet

**Metrics**:
- Import count: Reduced from 108 to ~80
- New packages: 3
- Build time: <45s (unchanged)
- Bundle size: <500KB (slight improvement)

### Phase 2 Success (Week 3-4)

**Must Have**:
- [ ] All E2E tests pass
- [ ] Zero TypeScript errors
- [ ] All apps build successfully
- [ ] wallet-shared deleted
- [ ] Zero import errors
- [ ] No code duplication
- [ ] All features working

**Metrics**:
- Import count: ~120 locations (spread across 7 packages)
- New packages: 7 total
- Build time: <40s (slight improvement from better caching)
- Bundle size: <300KB (improved tree-shaking)

### Long-Term Success (3-6 months)

**Indicators**:
- [ ] New features added easily (clear package home)
- [ ] Parallel development possible (no conflicts)
- [ ] Test coverage increasing (isolated testing)
- [ ] Bundle size stable or decreasing
- [ ] No architectural debt accumulation
- [ ] Team velocity maintained or improved

---

## Risk Assessment & Mitigation

### Phase 1 Risks

**Risk 1: Breaking Changes**
- **Probability**: Low
- **Impact**: Medium
- **Mitigation**:
  - Comprehensive E2E tests before starting
  - Incremental changes (one package at a time)
  - Test after each package extraction
  - Keep wallet-shared as fallback

**Risk 2: Import Update Errors**
- **Probability**: Medium
- **Impact**: Low
- **Mitigation**:
  - Use automated find-replace (sed)
  - TypeScript will catch missing imports
  - Run typecheck frequently

**Risk 3: Team Bandwidth**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Phase 1 can be done by 1 person
  - Allocate 10 working days
  - Can pause after Phase 1

### Phase 2 Risks

**Risk 1: Complex Refactoring**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Learn from Phase 1 experience
  - Keep wallet-shared temporarily during migration
  - Delete only when imports are zero

**Risk 2: Incomplete Migration**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**:
  - Set hard deadline for Phase 2 start (1 week after Phase 1)
  - Allocate dedicated time (don't interleave with features)
  - Track progress daily

**Risk 3: Production Issues**
- **Probability**: Low
- **Impact**: High
- **Mitigation**:
  - Deploy to dev environment first
  - Monitor for 2-3 days
  - Have rollback plan ready
  - Deploy during low-traffic hours

---

## Rollback Plans

### Phase 1 Rollback

If critical issues found after Phase 1:

```bash
# Revert to main
git checkout main

# Cherry-pick specific fixes if needed
git cherry-pick <commit-hash>
```

**Worst Case**: Keep new packages, re-export from wallet-shared:
```typescript
// packages/wallet-shared/src/stores/index.ts
export * from "@frak-labs/wallet-stores";
```

### Phase 2 Rollback

If issues found during Phase 2:

```bash
# Stop migration
# Keep wallet-shared
# Delete new packages
# Revert import changes
```

**Worst Case**: Keep both old and new packages temporarily:
- wallet-shared (old code)
- wallet-domain/wallet-ui/wallet-infra (new code)
- Gradually migrate over 2-4 weeks

---

## What Can Be Deferred to Future

### After Strategy 3 Completion

**Can add later if needed** (likely 6-12 months out):

1. **Granular Domain Packages**:
   - Split `wallet-domain` → `wallet-auth`, `wallet-operations`, `wallet-tokens`, etc.
   - **When**: Team grows to 5+ developers
   - **Effort**: 1-2 weeks

2. **API Contracts Package**:
   - Create `api-contracts` to decouple from backend
   - **When**: Multiple backend versions need support
   - **Effort**: 1 week

3. **Shared Types Package**:
   - Extract common types to `shared-types`
   - **When**: Types are reused across 4+ packages
   - **Effort**: 3-5 days

4. **UI Primitives Package**:
   - Split `ui` → `ui-primitives` + `ui-components`
   - **When**: UI library is published externally
   - **Effort**: 1 week

5. **Blockchain Subpackages**:
   - Split `blockchain` → `blockchain-abis`, `blockchain-addresses`, etc.
   - **When**: Blockchain code exceeds 5,000 LOC
   - **Effort**: 3-5 days

**Principle**: Only split when you feel the pain. YAGNI (You Aren't Gonna Need It).

---

## Decision Framework for Team

### Questions to Ask

1. **What's our team size?**
   - 1-2 devs → Strategy 2 (Conservative)
   - 2-4 devs → Strategy 3 (Progressive) ⭐
   - 5+ devs → Strategy 1 (Comprehensive)

2. **What's our bandwidth?**
   - Very limited (1 week) → Strategy 2
   - Moderate (2-3 weeks) → Strategy 3 ⭐
   - Lots of time (4-5 weeks) → Strategy 1

3. **What's our risk tolerance?**
   - Low risk → Strategy 2
   - Moderate risk → Strategy 3 ⭐
   - High risk acceptable → Strategy 1

4. **What's our time horizon?**
   - 3-6 months → Strategy 2
   - 6-18 months → Strategy 3 ⭐
   - 2+ years → Strategy 1

5. **How critical is architecture?**
   - Just fix issues → Strategy 2
   - Good architecture → Strategy 3 ⭐
   - Perfect architecture → Strategy 1

### Recommendation Matrix

| Scenario | Recommended Strategy |
|----------|---------------------|
| Small team, limited time, low risk tolerance | Strategy 2 (Conservative) |
| Medium team, moderate time, balanced approach | **Strategy 3 (Progressive)** ⭐ |
| Large team, lots of time, long-term focus | Strategy 1 (Comprehensive) |
| Need quick fixes to unblock development | Strategy 2 (Conservative) |
| Want to improve architecture without over-engineering | **Strategy 3 (Progressive)** ⭐ |

---

## Final Recommendation

### Choose Strategy 3 (Progressive)

**Why**:
1. ✅ Solves 90% of issues with 50% of effort
2. ✅ Achievable in 2-3 weeks (2 sprints)
3. ✅ Low to moderate risk (phased approach)
4. ✅ Can pause after Phase 1 if needed
5. ✅ Best balance of pragmatism and quality

**Compromises We're Making**:
- Not as granular as Strategy 1 (acceptable for team size)
- Two rounds of import updates (annoying but manageable)
- Temporary state with wallet-shared in Phase 1 (short-lived)

**What We're NOT Compromising**:
- Architecture quality (still very good)
- Next.js compatibility (fixed in Phase 1)
- Component duplication (fixed in Phase 1)
- Tree-shaking benefits (good enough)
- Maintainability (great)

**Expected Outcome**:
- Week 1-2: Critical issues solved ✅
- Week 3-4: Clean architecture achieved ✅
- Month 2-12: Faster feature development (30-40% improvement) ✅
- Year 1-2: Can refine further if team grows ✅

---

## Implementation Checklist

### Before Starting

- [ ] Team meeting to review this analysis
- [ ] Agree on Strategy 3 (or choose alternative)
- [ ] Allocate 2-3 weeks for refactoring
- [ ] Feature freeze during migration
- [ ] Assign 1-2 developers
- [ ] Set clear Phase 1 deadline (2 weeks max)

### Phase 1: Critical Extractions

- [ ] Create 3 new packages (wallet-stores, blockchain, webauthn)
- [ ] Extract and test wallet-stores
- [ ] Split app-essentials
- [ ] Fix AlertDialog duplication
- [ ] Run all tests
- [ ] Update CLAUDE.md
- [ ] Deploy to dev environment
- [ ] **PAUSE POINT**: Evaluate before Phase 2

### Phase 2: Domain Extraction

- [ ] Create 4 new packages (wallet-domain, wallet-ui, wallet-infra, polyfills)
- [ ] Extract wallet-domain
- [ ] Extract wallet-ui
- [ ] Extract wallet-infra
- [ ] Consolidate polyfills
- [ ] Delete wallet-shared
- [ ] Run all tests
- [ ] Update documentation
- [ ] Deploy to production

### After Completion

- [ ] Monitor production for 1 week
- [ ] Retrospective meeting
- [ ] Document learnings
- [ ] Plan future improvements (if needed)
- [ ] Celebrate! 🎉

---

## Conclusion

The **wallet-shared god package** is your biggest architectural challenge. All four strategies are valid, but **Strategy 3 (Progressive)** offers the best balance:

- **Fast enough** to deliver value in 2-3 weeks
- **Safe enough** to pause after Phase 1 if needed
- **Good enough** architecture for 6-18 month horizon
- **Flexible enough** to refine later as team grows

**Don't let perfect be the enemy of good**. Strategy 3 solves 90% of your problems with 50% of the effort. You can always refine later.

**Next Step**: Schedule a 2-hour team meeting to review this analysis and make a decision.

---

## Appendix: Package Dependency Graph

### Current State (Strategy 0)

```
apps/wallet → wallet-shared (god package)
                ├── ui
                ├── app-essentials
                ├── client
                ├── backend-elysia (dev)
                └── 10+ external deps
```

### After Strategy 3 (Progressive)

```
apps/wallet → wallet-domain → blockchain
           │               → webauthn
           │               → client
           │
           → wallet-ui → ui
           │          → wallet-domain
           │          → wallet-stores
           │
           → wallet-stores (no deps!)
           │
           → wallet-infra → blockchain
                         → analytics libs
```

**Benefits**:
- Clear dependency flow (domain → infra)
- No circular dependencies
- wallet-stores has zero deps (pure state)
- UI depends on domain (proper layering)
- Easier to test and mock

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude (Architecture Reviewer)
**Recommended Strategy**: Strategy 3 (Progressive) ⭐⭐⭐
