# Web2 Migration: Implementation Plan

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Timeline Overview

### 1.1 Gantt Chart

```
Week     1    2    3    4    5    6    7    8    9   10   11   12
        ┌────┐
Phase 1 │████│ Foundation
        └────┘
             ┌─────────┐
Phase 2      │█████████│ Backend Services
             └─────────┘
                  ┌─────────┐
Phase 3           │█████████│ Smart Contracts
                  └─────────┘
                       ┌─────────┐
Phase 4                │█████████│ Frontend/SDK
                       └─────────┘
                                  ┌─────────────────────┐
Phase 5                           │█████████████████████│ Migration & Launch
                                  └─────────────────────┘

Milestones:
  ▼ Week 2:  Database schema complete
  ▼ Week 5:  Backend services complete
  ▼ Week 6:  Contracts on testnet
  ▼ Week 9:  All apps updated
  ▼ Week 12: Production launch
```

### 1.2 Phase Summary

| Phase | Duration | Focus | Team |
|-------|----------|-------|------|
| 1 | 2 weeks | Database schema, infrastructure | Backend |
| 2 | 3 weeks | Backend services, API | Backend |
| 3 | 3 weeks | Smart contracts (parallel) | Blockchain |
| 4 | 3 weeks | Frontend, SDK | Frontend, SDK |
| 5 | 4 weeks | Migration, testing, launch | All |

---

## 2. Phase 1: Foundation (Weeks 1-2)

### 2.1 Goals
- Establish PostgreSQL schema
- Set up migration tooling
- Create feature flag system

### 2.2 Week 1 Tasks

| Task | Description | Estimate |
|------|-------------|----------|
| Schema design review | Finalize and review all table designs | 4h |
| Products domain schema | Implement products, product_banks, administrators tables | 4h |
| Campaigns domain schema | Implement campaigns, campaign_user_rewards tables | 4h |
| Interactions domain schema | Implement interactions table with indexes | 4h |
| Rewards domain schema | Implement rewards table | 2h |
| Run migrations | Create and test Drizzle migrations | 2h |
| Seed data scripts | Create development seed data | 4h |

### 2.3 Week 2 Tasks

| Task | Description | Estimate |
|------|-------------|----------|
| MongoDB migration script (products) | Script to migrate products collection | 8h |
| MongoDB migration script (campaigns) | Script to migrate campaigns collection | 8h |
| Feature flag system | Set up for gradual rollout | 4h |
| Data validation tools | Compare MongoDB vs PostgreSQL | 4h |
| Documentation | Document schema decisions | 4h |

### 2.4 Deliverables
- [ ] PostgreSQL schema in dev environment
- [ ] Migration scripts tested with sample data
- [ ] Feature flags operational
- [ ] Schema documentation

### 2.5 Exit Criteria
- All migrations run without errors
- Seed data loads correctly
- Migration scripts tested with prod-like sample

---

## 3. Phase 2: Backend Services (Weeks 3-5)

### 3.1 Goals
- Implement core backend services
- Create new API endpoints
- Build campaign evaluation engine

### 3.2 Week 3 Tasks: Interaction Service

| Task | Description | Estimate |
|------|-------------|----------|
| InteractionService class | Create service with core methods | 8h |
| pushInteraction method | SDK interaction processing | 8h |
| Webhook handler | Shopify/WooCommerce/custom webhooks | 6h |
| OpenPanel correlation | Link interactions to OP sessions | 6h |
| Fallback fingerprinting | Handle adblocker cases | 4h |
| Deduplication logic | Prevent duplicate interactions | 4h |
| Unit tests | Full coverage for service | 8h |

### 3.3 Week 4 Tasks: Campaign Engine

| Task | Description | Estimate |
|------|-------------|----------|
| CampaignEngine class | Create service with CRUD | 6h |
| Campaign matching algorithm | Match interactions to campaigns | 8h |
| Budget checking | Enforce budget caps | 4h |
| ReferralService class | Build referral chains | 6h |
| Referral chain computation | Recursive query implementation | 8h |
| RewardCalculator class | Calculate distributions | 8h |
| Reward distribution formula | User + referrer chaining | 6h |
| Unit tests | Full coverage for engine | 8h |

### 3.4 Week 5 Tasks: API & Jobs

| Task | Description | Estimate |
|------|-------------|----------|
| /interactions API endpoints | Push, webhook, query | 6h |
| /campaigns API endpoints | CRUD operations | 6h |
| Update /business API | PostgreSQL data source | 8h |
| BatchRewardPusher job | Scheduled reward pushing | 8h |
| Reward signing logic | EIP-712 signatures | 6h |
| Monitoring & alerting | Job health monitoring | 4h |
| Integration tests | Full flow testing | 12h |

### 3.5 Deliverables
- [ ] All backend services implemented
- [ ] API endpoints functional
- [ ] Batch reward pusher operational
- [ ] >80% test coverage

### 3.6 Exit Criteria
- All unit tests pass
- Integration tests pass end-to-end
- Performance: <100ms interaction processing

---

## 4. Phase 3: Smart Contracts (Weeks 4-6)

### 4.1 Goals
- Develop and test contracts
- Deploy to testnet
- Security review

### 4.2 Week 4 Tasks: Development

| Task | Description | Estimate |
|------|-------------|----------|
| MultiTokenPushPull contract | Implement full contract | 12h |
| ProductBank contract | Implement full contract | 16h |
| Foundry tests (MultiTokenPushPull) | Unit tests | 8h |
| Foundry tests (ProductBank) | Unit tests | 12h |
| Deployment scripts | Forge scripts | 4h |

### 4.3 Week 5 Tasks: Testing

| Task | Description | Estimate |
|------|-------------|----------|
| Fuzz testing | Edge case discovery | 8h |
| Gas optimization | Reduce costs | 8h |
| Testnet deployment | Arbitrum Sepolia | 4h |
| Backend integration test | Test with real contracts | 8h |
| Security self-review | Internal audit | 16h |

### 4.4 Week 6 Tasks: Finalization

| Task | Description | Estimate |
|------|-------------|----------|
| Address security findings | Fix issues | 16h |
| Final testnet validation | Complete testing | 8h |
| Mainnet deployment plan | Document process | 8h |
| Contract documentation | NatSpec, README | 8h |
| Monitoring setup | Event monitoring | 8h |

### 4.5 Deliverables
- [ ] Contracts deployed to testnet
- [ ] Security review complete
- [ ] Mainnet deployment plan approved
- [ ] Documentation complete

### 4.6 Exit Criteria
- All tests pass (including fuzz)
- No critical security findings
- Testnet integration working
- Gas costs acceptable

---

## 5. Phase 4: Frontend & SDK (Weeks 6-9)

### 5.1 Goals
- Remove session from wallet app
- Update dashboard for PostgreSQL
- Simplify SDK

### 5.2 Weeks 6-7 Tasks: Wallet App

| Task | Description | Estimate |
|------|-------------|----------|
| Remove OpenSession component | Delete session UI | 4h |
| Remove session status indicators | Clean up status display | 4h |
| Update useWalletStatus hook | Remove session fields | 4h |
| Remove session from modals | Update modal flows | 6h |
| Update PendingReferral | Multi-token support | 8h |
| Test reward claiming | New contract integration | 8h |
| E2E tests | Update test suite | 8h |

### 5.3 Weeks 7-8 Tasks: Business Dashboard

| Task | Description | Estimate |
|------|-------------|----------|
| Update campaign creation | PostgreSQL-backed | 12h |
| Update campaign list | PostgreSQL queries | 8h |
| Enable instant updates | Remove deployment wait | 8h |
| Update analytics | PostgreSQL data source | 12h |
| Interaction dashboard | New analytics views | 12h |
| E2E tests | Update test suite | 8h |

### 5.4 Weeks 7-9 Tasks: SDK

| Task | Description | Estimate |
|------|-------------|----------|
| Remove session types | Clean type definitions | 4h |
| Update watchWalletStatus | Remove session fields | 6h |
| Simplify sendInteraction | Remove session check | 6h |
| Remove session APIs | openSession, closeSession | 4h |
| Update modal flows | Remove session step | 8h |
| Update React hooks | Remove session hooks | 8h |
| Unit tests | Full coverage | 12h |
| Integration tests | Listener integration | 8h |
| Documentation | Update docs | 8h |
| Migration guide | Partner documentation | 8h |
| Update examples | Fix example apps | 8h |
| Beta release | Publish to npm | 2h |

### 5.5 Deliverables
- [ ] Wallet app without session
- [ ] Dashboard using PostgreSQL
- [ ] SDK beta released
- [ ] All E2E tests passing

### 5.6 Exit Criteria
- No session UI visible anywhere
- Campaign CRUD works instantly
- SDK examples work
- Documentation complete

---

## 6. Phase 5: Migration & Launch (Weeks 9-12)

### 6.1 Goals
- Migrate production data
- Gradual rollout
- Full production launch

### 6.2 Week 9 Tasks: Data Migration

| Task | Description | Estimate |
|------|-------------|----------|
| Final MongoDB export | Production data | 4h |
| Run migration (staging) | Full data migration | 8h |
| Validate migrated data | Compare and verify | 8h |
| Migrate legacy rewards | Pending reward migration | 8h |
| Validate rewards | Verify balances | 8h |

### 6.3 Week 10 Tasks: Deployment

| Task | Description | Estimate |
|------|-------------|----------|
| Deploy contracts to mainnet | ProductBanks + MultiTokenPushPull | 4h |
| Deploy backend services | New services to production | 4h |
| Deploy frontend apps | Updated wallet + dashboard | 4h |
| Smoke tests | Basic functionality | 8h |
| Enable 10% traffic | Feature flag rollout | 2h |

### 6.4 Week 11 Tasks: Rollout

| Task | Description | Estimate |
|------|-------------|----------|
| Monitor 10% traffic | Watch metrics | Ongoing |
| Increase to 50% | Expand rollout | 2h |
| Monitor 50% traffic | Watch metrics | Ongoing |
| Address issues | Fix any problems | Variable |
| Increase to 100% | Full rollout | 2h |

### 6.5 Week 12 Tasks: Completion

| Task | Description | Estimate |
|------|-------------|----------|
| Disable MongoDB writes | Stop dual-writes | 2h |
| Simplify Ponder indexer | Remove legacy events | 4h |
| Archive legacy data | Backup and archive | 4h |
| Update monitoring | New dashboards | 4h |
| Final documentation | Update all docs | 8h |
| Retrospective | Team review | 4h |

### 6.6 Deliverables
- [ ] All data migrated
- [ ] 100% traffic on new system
- [ ] Legacy systems deprecated
- [ ] Documentation finalized

### 6.7 Exit Criteria
- 1 week at 100% without critical issues
- All success metrics met
- Team sign-off complete

---

## 7. Testing Strategy

### 7.1 Test Coverage Targets

| Component | Unit | Integration | E2E |
|-----------|------|-------------|-----|
| Backend Services | 80% | 60% | - |
| Smart Contracts | 90% | 70% | - |
| Frontend | 60% | - | 40% |
| SDK | 80% | 60% | - |

### 7.2 Critical Test Scenarios

1. **Reward Calculation**
   - Fixed rewards with referral chain
   - Range rewards with beta distribution
   - Budget cap enforcement
   - Per-user limit enforcement

2. **Referral Integrity**
   - Chain depth limits
   - Cycle detection
   - Cross-product isolation

3. **Blockchain Integration**
   - Signature verification
   - Nonce replay protection
   - Claim functionality

4. **User Flows**
   - Wallet creation (single biometry)
   - Interaction submission
   - Reward claiming

---

## 8. Rollback Plan

### 8.1 Rollback Triggers

| Condition | Severity | Action |
|-----------|----------|--------|
| Data corruption | Critical | Immediate rollback |
| >5% error rate | High | Reduce traffic, investigate |
| Reward errors | High | Pause batch pusher |
| Contract vulnerability | Critical | Pause contracts |

### 8.2 Rollback Levels

**Level 1: Traffic Reduction**
- Set feature flag to 0%
- All traffic to legacy
- Investigate and fix

**Level 2: Backend Rollback**
- Deploy previous version
- Revert migrations if needed
- Re-enable MongoDB

**Level 3: Contract Emergency**
- Pause ProductBank pushing
- Users can still claim existing
- New rewards queue in PostgreSQL

**Level 4: Full Rollback**
- All of above
- Revert frontends
- Publish previous SDK
- Post-mortem required

---

## 9. Success Criteria

### 9.1 Launch Criteria

- [ ] All automated tests pass
- [ ] Security review complete
- [ ] Performance benchmarks met
- [ ] Staging validated 48 hours
- [ ] Rollback tested
- [ ] On-call schedule established

### 9.2 Success Metrics (1 Week Post-Launch)

| Metric | Target |
|--------|--------|
| Onboarding completion | >85% |
| Interaction latency | <5 seconds |
| Error rate | <0.5% |
| Reward accuracy | 100% |
| Availability | 99.9% |
| Session support tickets | 0 |

---

## 10. Open Items

Before starting, resolve:

1. **Migration strategy**: Big bang or gradual?
2. **MongoDB deprecation**: How long parallel operation?
3. **Legacy rewards**: Migrate or let users claim from legacy?
4. **Partner notification**: Timeline for SDK upgrade?
5. **Security audit**: External audit required?

---

*This plan should be tracked in your project management tool with assigned owners and due dates.*
