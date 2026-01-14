# Anonymous Rewards Simplification

**Status**: Proposal  
**Created**: 2026-01-13  
**Authors**: Frak Engineering

---

## Executive Summary

This document proposes simplifying the anonymous reward distribution system by **removing on-chain locking** in favor of a **backend-only approach** using `asset_logs` as the single source of truth.

The current system locks rewards on-chain for anonymous users, then resolves them when a wallet is connected. The proposed system keeps rewards in `pending` status until a wallet is available, then pushes them directly.

---

## Philosophy

### The Current Approach: "Lock First, Resolve Later"

```
Anonymous User Earns Reward
        ↓
Settlement Job runs
        ↓
RewardsHub.lockReward(userId)  ←── On-chain transaction #1
        ↓
[Funds locked under opaque bytes32 userId]
        ↓
User connects wallet (days/weeks later)
        ↓
Queue pending_identity_resolution
        ↓
Resolution Job runs
        ↓
RewardsHub.resolveUserIds()  ←── On-chain transaction #2
        ↓
Funds now claimable
```

**The rationale**: Transparency. Rewards are visible on-chain immediately, even for anonymous users.

### The Problem with This Rationale

1. **Pseudo-transparency**: The locked rewards sit under an opaque `bytes32 userId` (encoded UUID). Without access to our backend database, no one can map this to a human identity. The "transparency" is technically true but practically useless.

2. **Who benefits?**: Anonymous users *by definition* don't have a wallet to check their balance. The only moment they care about their rewards is *after* connecting a wallet — at which point both approaches show them the same thing.

3. **False sense of security**: If Frak's backend goes down, on-chain locks remain... locked. The `resolveUserIds()` function still requires our backend to map identities. There's no trustless escape hatch.

4. **Doubled failure surface**: Two on-chain transactions means two opportunities for failure, gas spikes, or stuck states. We already have `pending_identity_resolutions` recovery logic — complexity that wouldn't exist in a simpler system.

### The Proposed Approach: "Hold Until Ready"

```
Anonymous User Earns Reward
        ↓
asset_logs entry created (status: pending, wallet: null)
        ↓
[Reward tracked in backend, not yet on-chain]
        ↓
User connects wallet
        ↓
Identity merge updates asset_logs.identityGroupId
        ↓
Next Settlement Job runs
        ↓
RewardsHub.pushReward(wallet)  ←── Single on-chain transaction
        ↓
Funds immediately claimable
```

**The rationale**: Simplicity. The blockchain is a settlement layer, not a waiting room.

---

## Why This Makes Sense

### 1. Blockchain as Settlement, Not Storage

The V2 architecture philosophy is "web2-first with blockchain as settlement layer." Locking rewards on-chain for anonymous users contradicts this — we're using the blockchain as a temporary holding pen, not for final settlement.

The blockchain should see rewards only when they're ready to be claimed.

### 2. Gas Efficiency

| Scenario | Current (Lock + Resolve) | Proposed (Push Only) |
|----------|-------------------------|---------------------|
| User connects wallet same day | 2 transactions | 1 transaction |
| User connects wallet after 1 week | 2 transactions | 1 transaction |
| User never connects wallet | 1 transaction (wasted) | 0 transactions |

For users who connect wallets quickly (the happy path), we save 50% on gas. For users who never return, we save 100%.

### 3. Reduced Complexity

**Removed**:
- `pending_identity_resolutions` table
- `IdentityResolutionBatchService`
- Resolution job scheduling
- Stuck resolution recovery logic
- Two-phase settlement state machine

**Simplified**:
- Settlement service only needs to check `walletAddress IS NOT NULL`
- Identity merge already updates `asset_logs.identityGroupId` — no additional work needed
- Single status flow: `pending` → `ready_to_claim` → `claimed`

### 4. Atomic Identity Resolution

Currently, when identities merge:
1. `asset_logs.identityGroupId` is updated (backend)
2. `pending_identity_resolution` is created (backend)
3. Resolution job runs (async)
4. `resolveUserIds()` is called (on-chain)

Steps 3-4 can fail independently, creating inconsistency between backend state and on-chain state.

With the proposed approach, identity merge is purely a backend operation. On-chain state is only created during settlement, ensuring consistency.

---

## Database Changes

### Tables to Remove

#### `pending_identity_resolutions`

```sql
DROP TABLE pending_identity_resolutions;
```

This table exists solely to queue userId→wallet mappings for on-chain resolution. With backend-only tracking, it's unnecessary.

### Tables to Modify

#### `asset_logs`

No schema changes required. The existing structure already supports this flow:

- `identityGroupId`: Links to identity (updated during merge)
- `walletAddress`: Denormalized from identity group (null for anonymous)
- `status`: Already has `pending` → `ready_to_claim` flow

**Consideration**: We may want to add an index or query optimization for finding pending rewards by identity group, since the settlement query changes slightly.

### Schema Cleanup

#### `identity_groups`

The `mergedGroups` JSONB column tracks merge history. This remains unchanged — it's useful for audit trails regardless of on-chain locking strategy.

---

## Migration Path

### Phase 1: Stop Creating New Locks

1. Modify `SettlementService` to skip anonymous rewards (no wallet)
2. Keep resolution job running for existing locks
3. Monitor: new `pending_identity_resolutions` should drop to zero

### Phase 2: Drain Existing Locks

1. Continue running resolution job until `pending_identity_resolutions` is empty
2. For truly orphaned locks (users who never return), decide on policy:
   - Leave locked forever (no action needed)
   - Admin resolution to treasury (requires governance decision)

### Phase 3: Remove Resolution Infrastructure

1. Drop `pending_identity_resolutions` table
2. Remove `IdentityResolutionBatchService`
3. Remove resolution job from scheduler
4. Clean up related monitoring/alerting

### Phase 4: Simplify Settlement

1. Update settlement query to include anonymous rewards with connected wallets
2. Remove lock-specific code paths from `SettlementService`
3. Update `RewardsHubRepository` to remove `lockRewards()` method (keep for reference/rollback)

---

## What We Must Be Careful About

### 1. Race Condition: Settlement vs. Wallet Connection

**Scenario**:
1. Settlement job starts, queries pending rewards
2. User connects wallet (identity merge happens)
3. Settlement job processes reward with OLD identityGroupId (no wallet)
4. Reward is skipped (no wallet) or worse, attributed incorrectly

**Mitigation**:
- Settlement should lock rows it's processing (`SELECT ... FOR UPDATE SKIP LOCKED`)
- Identity merge should not update `asset_logs` for rewards currently in settlement
- Consider: settlement window exclusion (don't process rewards created in last N minutes)

### 2. Long-Dormant Anonymous Rewards

**Scenario**: User earns rewards, never connects wallet, rewards sit in `pending` forever.

**Current behavior**: Rewards are locked on-chain (at least visible)

**New behavior**: Rewards exist only in database

**Considerations**:
- Is there a business case for on-chain visibility of dormant rewards?
- Should we have an expiration policy for unclaimed anonymous rewards?
- Reporting: how do we track "potential liability" of pending anonymous rewards?

### 3. Identity Merge Atomicity

**Scenario**: Identity merge partially completes — some `asset_logs` updated, then failure.

**Current behavior**: Same risk exists, but on-chain state is independent

**New behavior**: Partial merge means some rewards might settle to wrong wallet

**Mitigation**:
- Identity merge is already transactional (single DB transaction)
- Ensure `asset_logs` update is included in merge transaction
- Add verification: after merge, assert all rewards for merged groups point to anchor

### 4. Audit Trail for Anonymous Rewards

**Scenario**: Merchant asks "prove that user X earned reward Y before connecting wallet"

**Current behavior**: On-chain lock event with timestamp

**New behavior**: Only `asset_logs.createdAt` in database

**Mitigation**:
- `asset_logs` already has `createdAt` timestamp
- `interaction_logs` links reward to triggering event
- Consider: add `earnedAt` vs `settledAt` distinction if not already clear
- Attestation data in settlement transaction still provides proof

### 5. Consistency During Rollback

**Scenario**: We deploy this change, something goes wrong, need to rollback

**Problem**: Rewards created under new system have no on-chain locks

**Mitigation**:
- Keep `lockRewards()` code path available (feature flag)
- Rollback plan: re-enable locking, backfill locks for rewards created during new system
- Or: accept that rollback means those rewards stay backend-only until re-settled

### 6. Multi-Device Identity Merge Timing

**Scenario**:
1. User on Device A earns reward (identityGroup A)
2. User on Device B earns reward (identityGroup B)  
3. User connects wallet on Device A
4. Settlement runs, pushes reward A to wallet
5. User connects wallet on Device B (triggers merge A←B)
6. Reward B now points to merged group, settles next batch

**This is fine**, but consider:
- What if settlement is running DURING the merge?
- What if the merge fails after reward A settled but before B is updated?

**Mitigation**:
- Merge transaction must be atomic
- Settlement should use consistent snapshot (repeatable read or explicit locking)

### 7. Observability Gap

**Current state**: We can query on-chain for locked balances, cross-reference with backend

**New state**: Backend is single source of truth

**Mitigation**:
- Enhanced monitoring for `asset_logs` in pending state
- Dashboard showing: pending anonymous rewards by age, by merchant
- Alerting on: rewards pending > N days without wallet connection
- Regular reconciliation: settled rewards vs on-chain balances

---

## Decision Checklist

Before proceeding, confirm:

- [ ] **Business**: Is on-chain visibility of anonymous rewards a merchant requirement?
- [ ] **Legal**: Any regulatory implications of holding rewards off-chain?
- [ ] **Product**: How do we communicate "pending rewards" to anonymous users?
- [ ] **Finance**: How do we account for pending anonymous rewards (liability)?
- [ ] **Engineering**: Settlement job locking strategy defined
- [ ] **Engineering**: Rollback plan documented and tested
- [ ] **Ops**: Monitoring and alerting updated for new flow

---

## Conclusion

The on-chain locking mechanism for anonymous rewards adds complexity without proportional benefit. The "transparency" it provides is illusory — opaque userIds on-chain don't help anyone without backend access.

By treating the blockchain purely as a settlement layer, we:
- Halve gas costs for the common case
- Remove an entire subsystem (resolution jobs, pending table, recovery logic)
- Eliminate on-chain/off-chain consistency concerns
- Simplify the mental model: rewards exist in backend until settled

The main trade-off is losing the ability to point to on-chain locks as "proof" of pending rewards. If this matters for business reasons, we should reconsider. If it doesn't, the simplification is worth pursuing.

---

*This document should be reviewed by engineering, product, and business stakeholders before implementation begins.*
