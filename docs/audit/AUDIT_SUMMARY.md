# Technical Debt Audit: Summary & Navigation Guide

**Date**: 2025-10-24
**Branch**: `tech/cleanup-stores`

---

## 📚 Document Guide

This audit consists of 4 comprehensive documents:

### 1. **TECHNICAL_DEBT_AUDIT.md** (Main Report)
**Purpose**: Complete audit of entire monorepo
**When to read**: Start here for overall understanding

**Contents**:
- Executive summary of all 6 areas
- Wallet app analysis (B+ grade)
- Dashboard apps analysis (C grade)
- SDK packages analysis (B grade)
- Shared packages analysis (D+ grade)
- Backend analysis (C+ grade)
- Infrastructure analysis (B grade)
- 4-sprint action plan (30-35 days)
- Metrics & ROI

---

### 2. **BACKEND_DEEP_DIVE.md** (Backend Architecture)
**Purpose**: Detailed backend refactoring guide
**When to read**: When working on backend DDD implementation

**Contents**:
- Problem analysis (why you're "lost")
- Multi-consumer complexity (wallet/listener/SDK/dashboard)
- DDD violations with code examples
- Proposed architecture (domains + infrastructure)
- 6-step migration plan (3 weeks)
- Domain events implementation
- Testing strategy

**Key Insight**: "common" directory is the main culprit - mixes infrastructure with domain concepts.

---

### 3. **SHARED_PACKAGES_DEEP_DIVE.md** (Original Analysis)
**Purpose**: Original proposal to split wallet-shared into 7 packages
**When to read**: For historical context (NOT recommended anymore)

**Contents**:
- wallet-shared breakdown (100+ files)
- 5 critical violations
- 7-package split proposal
- 10-phase migration plan
- **NOTE**: Superseded by PACKAGE_SPLIT_OPTIONS.md

**Status**: ⚠️ **OBSOLETE** - Based on assumption that wallet-shared is a god package.

---

### 4. **PACKAGE_SPLIT_OPTIONS.md** (Data-Driven Analysis) ⭐
**Purpose**: Evidence-based package splitting recommendations
**When to read**: Before deciding on shared package refactoring

**Contents**:
- **Import analysis data** (228 imports analyzed)
- **Co-location patterns** (authentication+common 83% co-usage)
- **3 alternative strategies** with pros/cons
- **Effort estimation** (6 hours to 9 hours)
- **Comparison matrix** with scoring

**Key Finding**: wallet-shared is **NOT a god package** (97 files, well-organized).

---

## 🎯 Key Findings Summary

### Surprising Discovery

After analyzing actual import patterns and coupling metrics, we discovered:

**wallet-shared is NOT a god package** - it's a well-organized 97-file package with:
- Clear dependency hierarchy (stores/types have zero internal dependencies)
- Good separation (13 subdirectories with distinct concerns)
- Only used by wallet + listener apps (proper isolation)
- High co-location (authentication+common used together 83% of time)

**The real problems are specific issues, not package size:**
1. ❌ Missing "use client" directives (5 store files)
2. ❌ Component duplication with `ui` package
3. ❌ BigInt polyfill duplicated 3x
4. ⚠️ Not documented in CLAUDE.md

---

## 📊 Audit Grades by Area

| Area | Grade | Status | Priority |
|------|-------|--------|----------|
| **Wallet App** | B+ | Strong foundation, critical gaps | High |
| **Dashboard Apps** | C | Needs architectural decision | Medium |
| **SDK Packages** | B | Good foundation, fixable issues | High |
| **Shared Packages** | D+ → **B** | Re-evaluated as good, needs fixes | Medium |
| **Backend** | C+ | Transitional DDD, needs refactoring | High |
| **Infrastructure** | B | Good architecture, needs docs | Low |

---

## 🎯 Recommended Action Plan

### Week 1-2: Critical Fixes (Sprint 1)

**Backend** (5 days):
1. Refactor `common/` → `infrastructure/` (3 days)
2. Move integrations (6degrees, airtable) (1 day)
3. Implement basic domain events (1 day)

**Shared Packages** (1 day):
1. Add "use client" to 5 stores (2 hours)
2. Remove duplicate AlertDialog (1 hour)
3. Consolidate BigInt polyfill (30 min)
4. Document wallet-shared (30 min)
5. Add barrel exports (2 hours)

**Wallet App** (2 days):
1. Integrate Sentry error tracking (1 day)
2. Fix React SDK type resolution (2 hours)
3. Start service worker optimization (1 day)

---

### Week 3-4: Domain Boundaries (Sprint 2)

**Backend** (5 days):
1. Extract domain services (RolesRepository to auth) (2 days)
2. Split interactions → campaigns + interactions (2 days)
3. Add unit tests (40% coverage target) (1 day)

**Wallet App** (3 days):
1. Implement lazy loading (2 days)
2. Add Vitest setup (1 day)

---

### Week 5-6: Optional Enhancements (Sprint 3)

**Backend** (optional):
1. Split oracle → purchases + oracle infra (2 days)
2. Add event store (2 days)

**Shared Packages** (optional):
1. IF needed, extract wallet-state package (1 day)

---

## 💡 Key Recommendations

### For Backend:

**Problem**: "common" directory anti-pattern
**Solution**:
```
common/ → infrastructure/
  ├── persistence/     (db, mongodb)
  ├── blockchain/      (viemClient)
  ├── keys/            (AdminWalletsRepository)
  ├── pricing/         (PricingRepository)
  └── integrations/    (6degrees, airtable)
```

**Timeline**: 3 weeks
**Effort**: 7-9 days

---

### For Shared Packages:

**Problem**: Specific issues, not size
**Solution**: Option 1 - Status Quo + Fixes

**What to fix**:
1. Add "use client" directives (2h)
2. Remove duplicate AlertDialog (1h)
3. Consolidate BigInt polyfill (0.5h)
4. Document in CLAUDE.md (0.5h)
5. Add barrel exports (2h)

**Timeline**: 1 day (6 hours)
**Effort**: Very low risk

**Alternative**: If team wants formal state separation, extract wallet-state package (7 hours).

---

### For Wallet App:

**Priority fixes**:
1. Service worker size (97KB → <50KB) - Replace Dexie
2. Entry bundle (518KB → <300KB) - Lazy loading
3. Add unit tests (0% → 40%)
4. Integrate Sentry

**Timeline**: 2 weeks
**Effort**: Moderate

---

## 🚫 What NOT to Do

### ❌ Don't split wallet-shared into 13 packages

**Original proposal**: 7-13 packages (wallet-domain, wallet-ui, wallet-stores, wallet-infra, blockchain, webauthn, etc.)

**Why not**:
- Creates 85-100 cross-package imports (high coupling)
- Breaks co-location (authentication+common used together 83%)
- High circular dependency risk
- Maintenance overhead (13x package.json, tsconfig, etc.)
- Team cognitive load

**Verdict**: Over-engineered solution to a non-existent problem.

---

### ❌ Don't extract dashboard-admin yet

**Wait until deciding**:
- Complete the 3 stub views
- OR merge into main dashboard
- OR deprecate entirely

**Don't extract to separate repo** until decision is made.

---

### ❌ Don't do Option 3 in PACKAGE_SPLIT_OPTIONS.md

**Conservative Split (wallet-core + wallet-features)**:
- Higher effort (8-9h) than Option 2 (7h)
- Worse co-location (splits authentication+common)
- Similar coupling to Option 2

**Use Option 2 instead** if you need to split.

---

## 📈 Expected Outcomes

### After Sprint 1 (Week 1-2):

**Backend**:
- ✅ Infrastructure separated from domains
- ✅ Integrations moved out of domain layer
- ✅ Basic domain events working
- ✅ 20+ files no longer import from "common"

**Shared Packages**:
- ✅ All stores have "use client" directive
- ✅ No component duplication
- ✅ Single BigInt polyfill
- ✅ Documented in CLAUDE.md
- ✅ Clean barrel exports

**Wallet App**:
- ✅ Error tracking with Sentry
- ✅ SDK type errors fixed
- ✅ Service worker <50KB

---

### After Sprint 2 (Week 3-4):

**Backend**:
- ✅ Proper bounded contexts (authentication, authorization, campaigns, interactions)
- ✅ RolesRepository in auth domain
- ✅ Campaigns split from interactions
- ✅ 40% unit test coverage

**Wallet App**:
- ✅ Bundle size <300KB
- ✅ Lazy loading implemented
- ✅ Vitest setup complete

---

### Long-Term (After 2 Months):

**Velocity**: 30-40% faster feature development
**Onboarding**: Reduced from 2 weeks to 1 week
**Bug Rate**: Reduced by 20-30% (better testing)
**Architecture**: Scalable DDD with clear boundaries

---

## 🤔 Decision Framework

### For Shared Packages:

**Ask**: Is 97 files too many for one package?
- **If NO** → Option 1 (Status Quo + Fixes) - 6 hours
- **If YES** → Option 2 (Extract wallet-state) - 7 hours

**Ask**: Do we want explicit state management layer?
- **If YES** → Option 2
- **If NO** → Option 1

---

### For Backend:

**Ask**: Can we allocate 3 weeks for refactoring?
- **If YES** → Full 6-step migration plan
- **If NO** → Do Step 1-2 only (infrastructure extraction)

**Ask**: Is DDD important for our growth?
- **If YES** → Full migration (domains + events)
- **If NO** → Just fix "common" directory

---

### For Dashboards:

**Ask**: What's dashboard-admin's future?
- **Complete it** → Allocate 1 week dev time
- **Merge it** → 2 days to integrate into main dashboard
- **Deprecate it** → 1 day to remove

**Ask**: Should dashboards move out of monorepo?
- **Main dashboard** → NO (tight backend coupling justified)
- **Admin dashboard** → MAYBE (after completion decision)

---

## 📋 Quick Start Checklist

### Step 1: Read the Right Documents (30 min)

- [ ] Read this summary (you're here!)
- [ ] Skim TECHNICAL_DEBT_AUDIT.md for context
- [ ] Deep dive PACKAGE_SPLIT_OPTIONS.md for shared packages
- [ ] Deep dive BACKEND_DEEP_DIVE.md for backend

---

### Step 2: Team Discussion (2 hours)

**Agenda**:
1. Present key findings (wallet-shared is NOT god package)
2. Show 3 package split options with data
3. Discuss backend DDD violations
4. Decide on priorities (what to fix first?)
5. Choose package strategy (Option 1, 2, or status quo)
6. Assign ownership (who works on what?)

**Questions to answer**:
- [ ] Do we have 1-2 months for tech sprint?
- [ ] What's our risk tolerance? (low/moderate/high)
- [ ] Backend or frontend first?
- [ ] Option 1 or Option 2 for packages?
- [ ] Dashboard-admin fate? (complete/merge/deprecate)

---

### Step 3: Create GitHub Issues (1 hour)

**Sprint 1 Issues**:
- [ ] Backend: Refactor common → infrastructure
- [ ] Backend: Move integrations
- [ ] Backend: Implement domain events
- [ ] Packages: Add "use client" directives
- [ ] Packages: Remove duplicate AlertDialog
- [ ] Packages: Consolidate BigInt polyfill
- [ ] Packages: Document wallet-shared
- [ ] Wallet: Integrate Sentry
- [ ] SDK: Fix React SDK type resolution

**Label**: `tech-debt`, `sprint-1`
**Milestone**: Tech Sprint (Month 1)

---

### Step 4: Start Execution (Week 1)

**Parallel work (2 people)**:
- **Person 1**: Backend refactoring (common → infrastructure)
- **Person 2**: Package fixes + wallet Sentry integration

**Daily standup** to coordinate

---

## 📞 Need Help?

### For Clarifications:

**Backend questions** → Read BACKEND_DEEP_DIVE.md Section 4-6
**Package questions** → Read PACKAGE_SPLIT_OPTIONS.md "Comparison Matrix"
**Timeline questions** → See "Effort Estimation" sections in each doc
**Technical questions** → Each document has code examples

---

### For Implementation:

**Each document has**:
- Step-by-step migration plans
- Code examples (copy-paste ready)
- Bash commands for automation
- Testing strategies
- Rollback procedures

---

## 🎓 Lessons Learned

### 1. Data > Assumptions

**Assumption**: wallet-shared is a god package
**Reality**: 97 well-organized files with clean hierarchy

**Takeaway**: Always analyze import patterns before refactoring.

---

### 2. Co-Location Matters

**Finding**: authentication+common used together 83% of time
**Implication**: Splitting them creates tight coupling between packages

**Takeaway**: Keep code that changes together in the same package.

---

### 3. Fix Root Causes, Not Symptoms

**Symptoms**:
- Next.js build warnings
- Component duplication
- Polyfill side effects

**Root causes**:
- Missing "use client" directive
- No explicit UI package boundaries
- No polyfill consolidation

**Takeaway**: 6-hour fixes solve all symptoms. No need for 13-package split.

---

### 4. Backend "common" is Real Problem

**Problem**: 17 exports, 40+ files depend on it
**Impact**: Can't test domains in isolation, tight coupling

**Takeaway**: Backend needs refactoring. Shared packages don't.

---

## 🚀 Final Recommendations Priority

### P0 (Do This Week):
1. ✅ Add "use client" to stores (2h)
2. ✅ Integrate Sentry in wallet app (1 day)
3. ✅ Fix React SDK type resolution (2h)
4. ✅ Document wallet-shared in CLAUDE.md (30m)

### P1 (Do This Month):
5. ✅ Backend: Refactor common → infrastructure (3 days)
6. ✅ Backend: Move integrations out (1 day)
7. ✅ Wallet: Optimize service worker (1 day)
8. ✅ Remove duplicate AlertDialog (1h)

### P2 (Do Next Month):
9. ✅ Backend: Implement domain events (2 days)
10. ✅ Backend: Split domains (campaigns, purchases) (4 days)
11. ✅ Wallet: Add lazy loading (2 days)
12. ✅ Wallet: Add unit tests (3 days)

### P3 (Optional / Future):
13. ⚠️ Extract wallet-state package (IF needed) (1 day)
14. ⚠️ Dashboard-admin completion/deprecation (1 week)
15. ⚠️ Infrastructure documentation (2 days)

---

## 🎯 Success Metrics

Track these metrics monthly:

| Metric | Before | Target (2 months) |
|--------|--------|-------------------|
| Backend "common" imports | 40+ | 0 |
| Wallet entry bundle | 518KB | <300KB |
| Service worker size | 97KB | <50KB |
| Unit test coverage | 0% | 40% |
| Backend unit tests | ~10% | 60% |
| Package count | 5 | 5-6 |
| Cross-package imports | 0 (wallet-shared internal) | <40 (if split) |
| Time to add feature | 3 days | 2 days |
| Onboarding time | 2 weeks | 1 week |

---

## 📝 Changelog

**2025-10-24**:
- Initial audit complete
- 4 documents published
- Data analysis revealed wallet-shared is NOT god package
- Revised recommendation from 13 packages to 5-6 packages

---

**Good luck with your tech sprint! 🚀**

*Remember: Perfect is the enemy of good. Ship incremental improvements, iterate based on learnings.*
