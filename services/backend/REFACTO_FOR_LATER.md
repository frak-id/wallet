# Backend Refactoring - Future Improvements

This document tracks architectural improvements and optimizations to be implemented after the initial V1 release.

---

## 1. Delayed Purchase Processing Cron (Priority: High)

### Problem

The current purchase linking flow has a race condition between webhook arrival and SDK `/track/purchase` call:

**Scenario A (Webhook First)**: Works correctly
- Webhook arrives → checks for pending identity node
- If found, links identity and processes rewards
- If not found, stores purchase with `identityGroupId=NULL`, waits for SDK

**Scenario B (SDK First)**: Works correctly
- SDK calls `/track/purchase` → creates pending `merchant_customer` node with `validationData`
- Webhook arrives → finds pending node, validates, links identity, processes rewards

**Scenario C (Edge Case - Returning Customer with New Referral)**: Partial support
- User made purchase before (existing `merchant_customer` → `grp_old`)
- User returns via NEW referral link (touchpoint created on NEW anonId → `grp_new`)
- Webhook arrives, finds existing `merchant_customer`, uses `grp_old` (OLD attribution)
- SDK calls later, merges `grp_new` INTO `grp_old`
- **Problem**: Rewards were already processed with OLD attribution

### Solution: Delayed Processing Cron

Instead of processing rewards immediately when webhook arrives with existing `merchant_customer`, 
delay processing by 30-60 seconds to allow the SDK call to arrive and properly merge identities.

```
New Flow:

1. Webhook arrives:
   - Store purchase with `identityGroupId` (if found via existing merchant_customer)
   - Set `rewardsProcessedAt = NULL` (not processed yet)
   - Return 200 OK immediately (webhook response time <500ms)

2. SDK call arrives (within 30-60 seconds):
   - Resolves anonId → grp_new
   - Finds merchant_customer → grp_old
   - MERGES grp_new INTO grp_old (moves touchpoints to grp_old)
   - Now grp_old has the CORRECT/LATEST attribution

3. Cron job runs every 30 seconds:
   - Query: purchases WHERE identityGroupId IS NOT NULL 
            AND rewardsProcessedAt IS NULL 
            AND createdAt < NOW() - INTERVAL '1 minute'
   - For each purchase:
     - Re-fetch attribution (now includes merged touchpoints)
     - Process rewards with CORRECT attribution
     - Set rewardsProcessedAt = NOW()
```

### Implementation Tasks

1. **Schema Changes**:
   - Add `rewardsProcessedAt: timestamp | null` to `purchasesTable`
   - Add index on `(identityGroupId, rewardsProcessedAt, createdAt)` for cron query

2. **Webhook Handler Changes**:
   - Remove immediate `processRewardsForLinkedPurchase()` call
   - Let cron handle all reward processing

3. **New Cron Job**:
   - Location: `services/backend/src/jobs/processDelayedPurchases.ts`
   - Frequency: Every 30 seconds (use `mutexCron` to prevent overlap)
   - Batch size: Process 100 purchases per run
   - Timeout handling: Skip purchases that fail, retry next run

4. **Logging & Monitoring**:
   - Log when purchase is queued for delayed processing
   - Log when cron processes purchase with final attribution source
   - Alert if purchases remain unprocessed for >5 minutes

### Configuration

```typescript
// Environment variables
DELAYED_PURCHASE_PROCESSING_DELAY_SECONDS=60  // Wait time before processing
DELAYED_PURCHASE_BATCH_SIZE=100               // Max purchases per cron run
DELAYED_PURCHASE_MAX_AGE_MINUTES=10           // Alert threshold
```

### Rollback Strategy

If delayed processing causes issues:
1. Set `DELAYED_PURCHASE_PROCESSING_DELAY_SECONDS=0` to process immediately
2. Cron will still run but find no pending purchases
3. Can revert to immediate processing in webhook handler

---

## 2. Attribution Reprocessing for Merged Identities (Priority: Medium)

### Problem

When identities merge after rewards are already processed, the original attribution might be incorrect.

### Solution

Track which purchases were processed BEFORE an identity merge, and offer reprocessing.

1. Log identity merges with timestamp
2. Query rewards created before merge, for the merged identity
3. Optionally reprocess with updated attribution (requires campaign rule history)

### Complexity

High - requires versioning of campaign rules and careful handling of budget recalculation.
Defer to V3.

---

## 3. Webhook Retry Queue (Priority: Low)

### Problem

If reward processing fails (campaign service down, DB timeout), purchase is stored but no rewards created.

### Solution

Implement a retry queue for failed reward processing:

1. On failure, store in `failed_reward_processing` table
2. Background job retries every 5 minutes, up to 3 times
3. Alert if exhausted

### Note

Current implementation logs errors but doesn't retry. Acceptable for V1.

---

## 4. Purchase Token Validation Improvements (Priority: Low)

### Current Behavior

The `validationData` on `identity_nodes` stores `{orderId, purchaseToken}` for matching.
If token doesn't match, we log a warning but don't process.

### Future Improvement

- Track validation failures per merchant
- Alert if >5% mismatch rate (indicates potential SDK/webhook misconfiguration)
- Provide merchant dashboard visibility into failed links

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-09 | AI | Initial version with delayed processing cron proposal |
