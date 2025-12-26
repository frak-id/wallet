# Web2 Migration: Database Schema

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. Schema Overview

### 1.1 Design Principles

| Principle | Application |
|-----------|-------------|
| Single source of truth | PostgreSQL replaces MongoDB for all business data |
| Referrals via interactions | No separate referrals table; use indexed interaction column |
| Multi-token support | Token address stored with campaigns and rewards |
| Audit trail | Timestamps on all records |
| Soft deletes | Use `deleted_at` where appropriate |

### 1.2 Domain Organization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE DOMAINS                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    PRODUCTS DOMAIN                    CAMPAIGNS DOMAIN
    ───────────────                    ────────────────
    • products                         • campaigns
    • product_banks                    • campaign_user_rewards
    • product_administrators

    INTERACTIONS DOMAIN                REWARDS DOMAIN
    ───────────────────                ──────────────
    • interactions                     • rewards (single table)
```

---

## 2. Products Domain

### 2.1 Table: `products`

**Purpose:** Store product configuration (migrated from MongoDB)

| Column | Type | Description |
|--------|------|-------------|
| `id` | hex | Primary key, matches on-chain productId |
| `domain` | varchar(255) | Product domain (unique) |
| `name` | varchar(255) | Display name |
| `owner_address` | hex/address | Owner wallet address |
| `product_types` | integer | Bitmask of product type flags |
| `metadata` | jsonb | Logo, description, etc. |
| `webhook_config` | jsonb | Shopify/WooCommerce/custom webhook settings |
| `is_active` | boolean | Active status |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update |
| `deleted_at` | timestamp | Soft delete |

**Indexes:**
- domain (unique)
- owner_address
- is_active

---

### 2.2 Table: `product_banks`

**Purpose:** Track ProductBank contract deployments per product/token

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `product_id` | hex | FK to products |
| `address` | hex/address | Contract address |
| `token_address` | hex/address | Token this bank distributes |
| `token_symbol` | varchar(20) | Token symbol (EURe, USDe, etc.) |
| `token_decimals` | integer | Token decimals (default: 18) |
| `is_active` | boolean | Active status |
| `created_at` | timestamp | Creation time |
| `deployed_at` | timestamp | Deployment time |

**Constraints:**
- Unique on (product_id, token_address)

---

### 2.3 Table: `product_administrators`

**Purpose:** Role-based access control for products

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `product_id` | hex | FK to products |
| `wallet` | hex/address | Administrator wallet |
| `roles` | integer | Role bitmask |
| `created_at` | timestamp | Creation time |
| `granted_by` | hex/address | Who granted the role |

**Role Bitmask:**
- `1 << 0`: Product Administrator (full access)
- `1 << 1`: Campaign Manager
- `1 << 2`: Interaction Manager
- `1 << 3`: Oracle Updater

---

## 3. Campaigns Domain

### 3.1 Table: `campaigns`

**Purpose:** Campaign definitions (migrated from MongoDB, enhanced)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `external_id` | hex | UUID for API compatibility |
| `product_id` | hex | FK to products |
| `product_bank_id` | integer | FK to product_banks |
| `name` | varchar(255) | Campaign name |
| `description` | text | Campaign description |
| **Trigger Config** | | |
| `trigger_type` | enum | purchase.completed, referral.referred, etc. |
| `requires_referral` | boolean | Only reward if user was referred |
| **Reward Config** | | |
| `reward_type` | enum | fixed, range |
| `base_reward` | bigint | For fixed rewards (in token wei) |
| `start_reward` | bigint | For range rewards (min) |
| `end_reward` | bigint | For range rewards (max) |
| `beta_percent` | integer | For range rewards (basis points) |
| **Chaining Config** | | |
| `user_percent` | integer | User's share (basis points, default: 5000 = 50%) |
| `deperdition_per_level` | integer | Referrer decay (basis points, default: 8000 = 80%) |
| `max_referral_depth` | integer | Max chain depth (default: 5) |
| **Limits** | | |
| `max_rewards_per_user` | integer | Per-user cap (null = unlimited) |
| `budget_cap` | bigint | Total budget (0 = unlimited) |
| `used_budget` | bigint | Distributed so far |
| **Schedule** | | |
| `starts_at` | timestamp | Start time (null = immediate) |
| `ends_at` | timestamp | End time (null = never) |
| **Status** | | |
| `status` | enum | draft, active, paused, budget_exhausted, expired, deactivated |
| **Metadata** | | |
| `metadata` | jsonb | Legacy IDs, display info |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update |
| `activated_at` | timestamp | When activated |
| `created_by` | hex/address | Creator wallet |

**Trigger Types:**
- `purchase.completed`
- `purchase.started`
- `referral.referred`
- `referral.link_creation`
- `webshop.open`
- `press.open_article`
- `press.read_article`

**Indexes:**
- product_id
- status
- trigger_type
- Composite: (status, starts_at, ends_at) for active campaign queries

---

### 3.2 Table: `campaign_user_rewards`

**Purpose:** Track rewards per user per campaign (for limit enforcement)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `campaign_id` | integer | FK to campaigns |
| `wallet` | hex/address | User wallet |
| `reward_count` | integer | Number of rewards received |
| `total_amount` | bigint | Total amount received |
| `first_reward_at` | timestamp | First reward time |
| `last_reward_at` | timestamp | Last reward time |

**Constraints:**
- Unique on (campaign_id, wallet)

---

## 4. Interactions Domain

### 4.1 Table: `interactions`

**Purpose:** Store all user interactions with indexed referral data

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `product_id` | hex | FK to products |
| `wallet` | hex/address | User wallet |
| `type` | enum | Interaction type |
| `data` | jsonb | Type-specific data |
| **Referral Data (Indexed)** | | |
| `referrer_wallet` | hex/address | For referral.referred: who referred |
| **Analytics Correlation** | | |
| `openpanel_session_id` | varchar(100) | OpenPanel session ID |
| `openpanel_device_id` | varchar(100) | OpenPanel device ID |
| `openpanel_profile_id` | varchar(100) | OpenPanel profile ID |
| `fallback_fingerprint` | varchar(255) | Fallback when OP blocked |
| **Deduplication** | | |
| `dedup_key` | varchar(255) | Type-specific dedup key |
| **Metadata** | | |
| `source` | varchar(50) | sdk, webhook_shopify, etc. |
| `source_ip` | varchar(45) | IPv6 compatible |
| `user_agent` | varchar(500) | Browser user agent |
| `created_at` | timestamp | Creation time |
| `processed_at` | timestamp | When campaign evaluation completed |

**Interaction Types:**
- `referral.referred`
- `referral.link_creation`
- `purchase.started`
- `purchase.completed`
- `webshop.open`
- `press.open_article`
- `press.read_article`
- `retail.customer_meeting`

**Key Design: Referral Tracking via Interactions**

Instead of a separate `referrals` table:
- `referral.referred` interaction stores `referrer_wallet`
- Column is indexed for efficient chain queries
- Chain computed via recursive query on this column
- Single source of truth for all interaction data

**Indexes:**
- product_id
- wallet
- type
- referrer_wallet (for chain queries)
- Composite: (product_id, wallet, type) for referral lookup
- Composite: (product_id, wallet, type, dedup_key) for deduplication
- openpanel_session_id, openpanel_device_id
- created_at
- processed_at (for unprocessed batch queries)

---

## 5. Rewards Domain

### 5.1 Table: `rewards`

**Purpose:** Single table tracking reward lifecycle from creation to blockchain push.

**Design Rationale:**
- One table instead of separate pending/pushed tables
- Simple state machine: `pending → pushed`
- `claimed` state comes from Ponder indexer (no duplication)
- No retry counters in DB - stateless batch job re-queries on failure

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `wallet` | hex/address | Recipient wallet |
| `campaign_id` | integer | FK to campaigns |
| `interaction_id` | integer | FK to interactions |
| `token_address` | hex/address | Reward token |
| `amount` | bigint | Reward amount (wei) |
| `recipient_type` | enum | user, referrer_l1, referrer_l2, referrer_l3, referrer_l4, referrer_l5 |
| `status` | enum | pending, pushed |
| `tx_hash` | hex | Transaction hash (null until pushed) |
| `created_at` | timestamp | Reward creation time |
| `pushed_at` | timestamp | Push time (null until pushed) |

**Status Flow:**
```
pending ──(batch push succeeds)──► pushed
    │
    └── On failure: stays pending, next batch picks it up
```

**Indexes:**
- `(status, token_address, created_at)` - Batch job queries pending rewards grouped by token
- `(wallet, status)` - User pending lookup
- `(campaign_id)` - Campaign analytics
- `(tx_hash)` - Verification lookups

**Notes:**
- No `claimed` status - that comes from Ponder indexing `RewardClaimed` events
- No retry counters or error messages - batch job is stateless
- No archive table - historical data stays in same table with `status = 'pushed'`

---

## 6. Migration from MongoDB

### 6.1 Collections to Migrate

| MongoDB Collection | PostgreSQL Table | Notes |
|--------------------|------------------|-------|
| `products` | `products` | Add new fields, map productTypes |
| `campaigns` | `campaigns` | Map legacy contract addresses to metadata |
| `team-members` | `product_administrators` | Convert role format |
| `campaign-stats` | Computed from rewards | Don't migrate, recompute |

### 6.2 Migration Strategy

1. **Parallel Operation Phase (2 weeks)**
   - Both systems active
   - Writes to both
   - Reads from MongoDB (production)
   - Reads from PostgreSQL (validation)

2. **Validation Phase (1 week)**
   - Compare data between systems
   - Fix discrepancies
   - Build confidence

3. **Cutover Phase**
   - Switch reads to PostgreSQL
   - Stop MongoDB writes
   - Monitor for issues

4. **Cleanup Phase**
   - Archive MongoDB
   - Remove dual-write code

### 6.3 Data Mapping Notes

**Products:**
- `productId` → `id` (hex)
- `productTypes` bitmask stays the same
- Add `webhook_config` for existing integrations

**Campaigns:**
- Store legacy contract address in `metadata.legacyContractAddress`
- Store MongoDB `_id` in `metadata.legacyMongoId`
- Map trigger configurations to new schema

---

## 7. Query Patterns

### 7.1 Critical Queries

| Query | Frequency | Index Strategy |
|-------|-----------|----------------|
| Get active campaigns for product | Very High | Composite index on (status, product_id, starts_at, ends_at) |
| Get referral chain | High | Index on referrer_wallet + recursive CTE |
| Get pending rewards for batch | High (scheduled) | Composite on (status, token_address, created_at) |
| Get user pending rewards | High | Composite on (wallet, status) |
| Check user reward count | High | campaign_user_rewards unique index |
| Deduplicate interaction | High | Composite on (product_id, wallet, type, dedup_key) |

### 7.2 Referral Chain Query Pattern

```
Use recursive CTE:
1. Start with target wallet
2. Find referral.referred interaction
3. Get referrer_wallet
4. Repeat for referrer (up to max_depth)
5. Return array of referrer addresses
```

### 7.3 Batch Reward Push Query Pattern

```sql
-- Get pending rewards grouped by token for batch push
SELECT 
    token_address,
    wallet,
    SUM(amount) as total_amount,
    ARRAY_AGG(id) as reward_ids
FROM rewards
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 minute'  -- Avoid race conditions
GROUP BY token_address, wallet
ORDER BY token_address, created_at
LIMIT 100;

-- After successful push, update in single statement
UPDATE rewards
SET status = 'pushed', tx_hash = ?, pushed_at = NOW()
WHERE id = ANY(?);
```

---

*Continue to [04-smart-contracts.md](./04-smart-contracts.md) for smart contract specifications.*
