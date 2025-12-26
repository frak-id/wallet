# Web2 Migration: Smart Contract Specifications

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Contract Overview

### 1.1 Design Goals

| Goal | Implementation |
|------|----------------|
| Minimal surface area | 2 core contracts instead of 15+ |
| Backend-authorized | Reward distribution via backend signatures |
| Token agnostic | Any ERC20 without redeployment |
| Transparent budget | On-chain budget tracking |
| Backward compatible | Same claiming UX for users |

### 1.2 Contract Summary

| Contract | Deployment | Purpose |
|----------|------------|---------|
| **ProductBank** | One per product | Fund custody, budget management, reward authorization |
| **MultiTokenPushPull** | Single global | Token-agnostic claiming |

### 1.3 Comparison with Legacy

| Aspect | Legacy | New |
|--------|--------|-----|
| Contracts per product | 5-10+ | 1 |
| Global contracts | 5+ | 1 |
| Campaign deployment | New contract each | None (database) |
| Token support | Per-contract | Any ERC20 |
| Reward calculation | On-chain | Backend |
| Reward distribution | Per-interaction TX | Batched |

---

## 2. ProductBank Contract

### 2.1 Purpose

ProductBank holds funds for a product and manages campaign budgets. It verifies backend signatures and forwards rewards to the global MultiTokenPushPull contract.

### 2.2 Deployment

- **One per product**
- Deployed when product owner wants to fund campaigns
- Constructor requires: productId, MultiTokenPushPull address, owner address

### 2.3 Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Withdraw funds, manage roles |
| **Manager** | Allocate campaign budgets, deactivate campaigns |
| **Distributor** | Push signed reward batches (backend signer) |

### 2.4 Functions

#### Fund Management

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(token, amount)` | Anyone | Deposit ERC20 tokens into bank |
| `withdraw(token, amount)` | Owner | Withdraw unused funds |
| `getAvailableBalance(token)` | View | Get current token balance |

#### Campaign Management

| Function | Access | Description |
|----------|--------|-------------|
| `allocateCampaignBudget(campaignId, token, budget)` | Manager | Set budget for campaign (0 = unlimited) |
| `deactivateCampaign(campaignId)` | Manager | Prevent further rewards for campaign |
| `getCampaignBudget(campaignId, token)` | View | Get remaining budget |
| `isCampaignActive(campaignId)` | View | Check if campaign can distribute |

#### Reward Distribution

| Function | Access | Description |
|----------|--------|-------------|
| `pushRewards(campaignId, token, rewards[], nonce, signature)` | Distributor | Push signed reward batch |

### 2.5 Budget Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BUDGET ENFORCEMENT                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Case 1: Unlimited Budget (budget = 0)
    ─────────────────────────────────────
    • No budget cap enforced
    • Only checks available bank balance
    • Fails if balance < total reward amount

    Case 2: Capped Budget (budget > 0)
    ──────────────────────────────────
    • Checks remaining budget >= total reward amount
    • Deducts from budget on successful push
    • Fails with InsufficientBudget if exceeded

    Both Cases:
    ──────────
    • Campaign must be active
    • Signature must be valid (EIP-712)
    • Nonce must not be reused
```

### 2.6 Signature Verification

**EIP-712 Domain:**
- Name: "Frak.ProductBank"
- Version: "1"
- ChainId: deployment chain
- VerifyingContract: ProductBank address

**Signed Data:**
- campaignId (bytes32)
- token (address)
- rewards array (user, amount pairs)
- nonce (bytes32)

**Verification:**
- Recover signer from signature
- Check signer has DISTRIBUTOR_ROLE
- Check nonce not already used

### 2.7 Events

| Event | Indexed Fields | Description |
|-------|----------------|-------------|
| `FundsDeposited` | token, depositor | Funds added to bank |
| `FundsWithdrawn` | token, recipient | Funds removed from bank |
| `CampaignBudgetAllocated` | campaignId, token | Budget set/updated |
| `CampaignDeactivated` | campaignId | Campaign stopped |
| `RewardsPushed` | campaignId, token | Batch pushed successfully |

---

## 3. MultiTokenPushPull Contract

### 3.1 Purpose

Global singleton that tracks pending rewards per (token, user) and allows users to claim any ERC20 token.

### 3.2 Deployment

- **Single global instance**
- All ProductBanks push to this contract
- Constructor requires: owner address

### 3.3 Functions

#### Pusher Management

| Function | Access | Description |
|----------|--------|-------------|
| `authorizePusher(address)` | Owner | Authorize a ProductBank |
| `revokePusher(address)` | Owner | Revoke authorization |
| `isPusherAuthorized(address)` | View | Check authorization |

#### Reward Distribution

| Function | Access | Description |
|----------|--------|-------------|
| `pushRewards(token, rewards[])` | Authorized Pusher | Add pending rewards |

**Note:** Only ProductBanks can call pushRewards. They transfer tokens first, then call this function.

#### Claiming

| Function | Access | Description |
|----------|--------|-------------|
| `pullReward(token)` | User | Claim single token |
| `pullRewards(tokens[])` | User | Claim multiple tokens |
| `getPendingAmount(token, user)` | View | Check pending balance |
| `getPendingAmounts(tokens[], user)` | View | Check multiple balances |
| `getTotalPending(token)` | View | Total pending for token |

### 3.4 Storage Structure

```
pendingAmounts[token][user] = amount
totalPending[token] = sum of all pending for token
authorizedPushers[address] = bool
```

### 3.5 Events

| Event | Indexed Fields | Description |
|-------|----------------|-------------|
| `RewardAdded` | token, user, emitter | Reward added to pending |
| `RewardClaimed` | token, user | User claimed reward |
| `PusherAuthorized` | pusher | ProductBank authorized |
| `PusherRevoked` | pusher | ProductBank revoked |

**Important:** `RewardAdded` and `RewardClaimed` are indexed by Ponder for wallet UI.

---

## 4. Contract Interaction Flow

### 4.1 Initial Setup

```
1. Deploy MultiTokenPushPull (once, global)
2. For each product:
   a. Deploy ProductBank(productId, multiTokenPushPull, owner)
   b. Call multiTokenPushPull.authorizePusher(productBank)
   c. Grant DISTRIBUTOR_ROLE to backend signer
   d. Product owner deposits funds
```

### 4.2 Campaign Lifecycle

```
1. Campaign created in PostgreSQL
2. If budget cap > 0:
   - Call productBank.allocateCampaignBudget(campaignId, token, budget)
3. Campaign active, processing rewards
4. To deactivate:
   - Call productBank.deactivateCampaign(campaignId)
```

### 4.3 Reward Push Flow

```
1. Backend accumulates pending rewards in PostgreSQL
2. Batch job runs every N minutes
3. For each (product, token) group:
   a. Build rewards array
   b. Generate nonce
   c. Sign with EIP-712
   d. Call productBank.pushRewards(...)
   e. ProductBank verifies signature
   f. ProductBank checks budget
   g. ProductBank transfers tokens to MultiTokenPushPull
   h. ProductBank calls multiTokenPushPull.pushRewards(...)
   i. Update PostgreSQL with txHash
```

### 4.4 User Claim Flow

```
1. User opens wallet app
2. Wallet queries Ponder for RewardAdded events
3. User sees pending amounts per token
4. User clicks "Claim"
5. Wallet calls multiTokenPushPull.pullReward(token)
6. Tokens transferred to user
7. Ponder indexes RewardClaimed event
8. Wallet updates UI
```

---

## 5. Security Considerations

### 5.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Backend key compromise | Multi-sig for high-value batches, rate limiting |
| Replay attacks | Nonce-based verification |
| Reentrancy | ReentrancyGuard on state-changing functions |
| Budget manipulation | On-chain tracking, only manager can allocate |
| Unauthorized pushers | Explicit authorization mapping |
| Front-running | Signatures include all parameters |

### 5.2 Access Control

| Contract | Role | Granted To |
|----------|------|------------|
| ProductBank | Owner | Product owner wallet |
| ProductBank | Manager | Product owner, team members |
| ProductBank | Distributor | Backend signer address |
| MultiTokenPushPull | Owner | Frak admin (multisig) |

### 5.3 Audit Checklist

- [ ] SafeTransferLib for all token transfers
- [ ] ReentrancyGuard on state-changing functions
- [ ] Access control on privileged functions
- [ ] Events for all state changes
- [ ] EIP-712 signature verification
- [ ] Nonce replay protection
- [ ] Zero address checks
- [ ] No selfdestruct
- [ ] No delegatecall to untrusted contracts

---

## 6. Deployment Addresses

### 6.1 Expected Addresses

| Contract | Network | Address |
|----------|---------|---------|
| MultiTokenPushPull | Arbitrum | TBD (deterministic) |
| MultiTokenPushPull | Arbitrum Sepolia | TBD |

### 6.2 ProductBank Factory (Optional)

Consider a factory contract for deterministic ProductBank deployment:
- Input: productId, owner
- Output: Predictable ProductBank address
- Benefits: Easier address discovery, consistent deployment

---

## 7. Legacy Contract Migration

### 7.1 Contracts to Deprecate

| Contract | Replacement |
|----------|-------------|
| ProductRegistry | PostgreSQL products table |
| ReferralRegistry | PostgreSQL interactions table |
| ProductAdministratorRegistry | Backend auth + PostgreSQL |
| ProductInteractionDiamond | Backend services |
| All InteractionFacets | Backend services |
| CampaignFactory | Backend services |
| Campaign contracts | Backend campaign engine |
| CampaignBank | ProductBank |
| PushPullModule | MultiTokenPushPull |
| InteractionDelegator | Removed |

### 7.2 Pending Reward Migration

For users with pending rewards in legacy PushPullModule:

**Option A: Let users claim from legacy**
- Keep legacy contracts active for 30-60 days
- Notify users to claim
- After deadline, unclaimed funds returned to product owners

**Option B: Migrate to new contract**
- Query all pending balances from legacy
- Batch push to new MultiTokenPushPull
- Users claim from new contract only

**Recommendation:** Option A for simplicity, with clear communication.

---

## 8. Gas Optimization

### 8.1 Batch Sizing

| Batch Size | Estimated Gas | Recommendation |
|------------|---------------|----------------|
| 10 rewards | ~150k | Minimum viable |
| 50 rewards | ~500k | Recommended |
| 100 rewards | ~900k | Maximum practical |
| 200+ rewards | >1.5M | May exceed block limit |

### 8.2 Optimization Strategies

- Use calldata efficiently (tight packing)
- Batch rewards by (product, token) to minimize contract calls
- Use multicall patterns where applicable
- Consider EIP-2929 access list for frequent storage reads

---

*Continue to [05-implementation-plan.md](./05-implementation-plan.md) for the implementation roadmap.*
