# Web2 Migration: Executive Overview

> **Version**: 1.0  
> **Status**: Planning Phase  
> **Last Updated**: December 2024

---

## 1. Executive Summary

The Frak platform was originally designed as a fully decentralized, extensible system anticipating open-source community contributions. This extensibility has not been utilized, and the current architecture introduces unnecessary complexity for our actual use case.

**This initiative simplifies the platform by moving interactions and campaigns to web2 while preserving on-chain reward distribution for transparency and user trust.**

### Before vs After

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| User onboarding | 2 biometry actions (wallet + session) | 1 biometry action (wallet only) |
| Campaign updates | Requires contract deployment | Instant database update |
| New event types | Full-stack + contract changes | Backend configuration |
| Analytics sources | Dual (OpenPanel + Ponder) | PostgreSQL primary |
| Active smart contracts | 15+ | 3 |

---

## 2. Problem Statement

### 2.1 User Experience Friction
- **Two biometry actions**: Users must create wallet AND activate session separately
- **Session expiration**: 30-day sessions require periodic reactivation
- **Processing delays**: Blockchain confirmation times affect interaction processing

### 2.2 Operational Inflexibility
- **Campaign rigidity**: Any campaign modification requires new contract deployment
- **Event type expansion**: Adding interaction types requires SDK + backend + contract changes
- **Budget complexity**: Campaign budgets tied to individual campaign contracts

### 2.3 Technical Overhead
- **Dual monitoring**: Ponder indexer for on-chain + OpenPanel for analytics
- **Complex pipeline**: 4-stage async processing (pending → simulate → sign → execute)
- **Session validation**: On-chain reads required before processing interactions

### 2.4 Underutilized Infrastructure
- Most interaction facets (Press, Dapp, Retail) unused in production
- Only `AffiliationFixedCampaign` with purchase-post-referral trigger actively used
- Diamond pattern extensibility never leveraged by third parties

---

## 3. Strategic Objectives

### Primary Objectives

| ID | Objective | Success Measure |
|----|-----------|-----------------|
| O1 | Simplify user onboarding | Session activation eliminated |
| O2 | Enable real-time campaign management | Campaign changes reflected instantly |
| O3 | Consolidate data sources | PostgreSQL as primary store |
| O4 | Maintain trust via on-chain rewards | Users can verify and claim on-chain |

### Secondary Objectives

| ID | Objective | Success Measure |
|----|-----------|-----------------|
| O5 | Reduce smart contract surface | 3 contracts instead of 15+ |
| O6 | Improve developer experience | Simpler SDK integration |
| O7 | Enable future ZKP path | Data structures compatible with Merkle proofs |

---

## 4. Solution: Hybrid Architecture

### 4.1 Core Principle

**Web2 for flexibility, Web3 for trust.**

- **Web2 handles**: Interactions, campaigns, referral tracking, reward calculation
- **Web3 handles**: Reward distribution and claiming (transparent, verifiable)

### 4.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WEB2 LAYER (PostgreSQL)                     │
│                                                                 │
│   Products → Campaigns → Interactions → Reward Calculation      │
│                              ↓                                  │
│                    Pending Rewards Queue                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                         Batch Push
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                  WEB3 LAYER (3 Contracts)                       │
│                                                                 │
│   ProductBank (per product) → MultiTokenPushPull (global)       │
│         ↓                              ↓                        │
│   Budget Management              Reward Claims                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INDEXER (Minimal Ponder)                     │
│                                                                 │
│   RewardAdded events → RewardClaimed events → Wallet UI         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Wallet type | Kernel + WebAuthn (unchanged) | No wallet migration needed, preserve claiming UX |
| Session system | Remove entirely | Core simplification goal |
| Reward tokens | Multi-token support | EURe, USDe, GBPe, USDC, mUSD |
| Budget management | On-chain ProductBank | Transparent, owner-controlled |
| Referral tracking | Indexed interaction events | Simpler than separate table |
| Campaign storage | PostgreSQL (migrate MongoDB) | Single source of truth |
| Analytics | OpenPanel + PostgreSQL | 95% coverage, graceful fallback for blocked users |

---

## 5. What Changes

### 5.1 Components Being Removed/Simplified

| Component | Current | After Migration |
|-----------|---------|-----------------|
| Session activation | Required (blockchain TX) | Removed |
| ProductRegistry | On-chain | PostgreSQL |
| ReferralRegistry | On-chain | Derived from interactions |
| ProductInteractionDiamond | Complex diamond pattern | Removed |
| InteractionFacets | 7 facet contracts | Removed |
| Campaign contracts | Deploy per campaign | Database records |
| CampaignBank | Per-campaign contract | Single ProductBank per product |
| PushPullModule | Single-token | Multi-token global contract |
| Ponder indexer | Full ecosystem indexing | Reward events only |

### 5.2 Components Being Added

| Component | Purpose |
|-----------|---------|
| Interaction Service | Receive, validate, store interactions |
| Campaign Engine | Evaluate rules, match interactions to campaigns |
| Reward Calculator | Compute rewards with referral chaining |
| Referral Service | Build chains from interaction history |
| Batch Reward Pusher | Push accumulated rewards to blockchain |
| ProductBank contract | Per-product budget management |
| MultiTokenPushPull contract | Token-agnostic reward claiming |

### 5.3 Components Unchanged

| Component | Notes |
|-----------|-------|
| Wallet app claiming | Same UX, different contract |
| WebAuthn authentication | No changes |
| SDK interaction API | Simplified (no session) |
| OpenPanel integration | Continue as-is |

---

## 6. Success Metrics

### 6.1 User Experience

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion rate | ~60% | >85% |
| Time to first interaction | ~45s | <15s |
| Session-related support tickets | ~20/month | 0 |

### 6.2 Operational

| Metric | Current | Target |
|--------|---------|--------|
| Campaign deployment time | 2-5 minutes | <1 second |
| New event type integration | 2-3 days | 2-4 hours |
| Interaction processing latency | 3-15 minutes | <5 seconds |

### 6.3 Technical

| Metric | Current | Target |
|--------|---------|--------|
| Smart contracts in production | 15+ | 3 |
| Database systems | 2 (Mongo + Postgres) | 1 (Postgres) |
| SDK bundle size | ~45KB | ~30KB |

---

## 7. Risk Assessment

### High Risk

| Risk | Mitigation |
|------|------------|
| Data migration errors | Comprehensive scripts with rollback, parallel operation period |
| Reward calculation bugs | Extensive testing, gradual rollout, monitoring |
| Backend compromise | Signature verification, rate limiting, monitoring |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| OpenPanel blocking (~5%) | Fallback fingerprinting for critical interactions |
| Ponder indexer desync | Health monitoring, manual resync capability |
| Migration timeline slip | Phased approach, clear milestones |

---

## 8. Document Index

| Document | Description |
|----------|-------------|
| [01-architecture.md](./01-architecture.md) | Detailed architecture, data flows, component interactions |
| [02-components.md](./02-components.md) | Component specifications and responsibilities |
| [03-database-schema.md](./03-database-schema.md) | PostgreSQL schema design, migration from MongoDB |
| [04-smart-contracts.md](./04-smart-contracts.md) | Smart contract specifications and interfaces |
| [05-implementation-plan.md](./05-implementation-plan.md) | Phased roadmap with tasks and milestones |
| [06-backend-architecture.md](./06-backend-architecture.md) | Backend folder structure, domain organization, patterns |

---

## 9. Open Questions

Before implementation begins, the team should align on:

1. **Migration strategy**: Big bang vs gradual feature flag rollout?
2. **MongoDB deprecation timeline**: How long to maintain parallel operation?
3. **Legacy reward migration**: Push existing pending rewards to new contract or let users claim from legacy?
4. **Partner communication**: Timeline and process for SDK upgrade notification?

---

*This document serves as the executive summary. For technical details, refer to the linked documents.*
