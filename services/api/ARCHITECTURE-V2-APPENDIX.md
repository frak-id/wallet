# Frak V2: Architecture Appendices

**Parent Document**: [ARCHITECTURE-V2.md](./ARCHITECTURE-V2.md)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Anonymous ID** | Browser fingerprint-based identifier stored in localStorage, reproducible per browser+merchant |
| **Identity Group** | A collection of identifiers (anon ID, customer ID, wallet) representing a single human |
| **Identity Anchor** | The wallet address that acts as the definitive identifier for an identity group |
| **Touchpoint** | A recorded interaction that could lead to attribution |
| **Attribution** | The process of deciding who gets credit for a conversion |
| **Lookback Window** | Time period within which touchpoints are considered for attribution |
| **Campaign Rule** | JSON-based configuration defining triggers, conditions, and rewards |
| **Attribution Rule** | JSON-based configuration defining source priority and conflict resolution |
| **Soft Reward** | Reward that never touches blockchain (discount, points, coupon) |
| **Hard Reward** | Reward settled on blockchain (USDC, ETH, tokens) |
| **Settlement** | The process of batching and pushing rewards to blockchain |
| **Attestation** | Cryptographic proof of reward context (future: ZKP-verified) |
| **Operational Event** | High-value event that triggers state changes (stored in PostgreSQL) |
| **Analytical Event** | Low-value event for insights only (stored in OpenPanel) |
| **Split-Brain** | Architecture pattern separating operational and analytical event streams |
| **P2P Referral** | Peer-to-peer referral where wallet address IS the referral code |

---

## Appendix B: API Endpoints

### Identity

```
POST   /identity/resolve          # Anonymous ID → Identity Group
POST   /identity/link             # Link merchant customer ID to identity group
POST   /identity/link-order       # Link Order ID to current Anonymous ID (for guest checkout correlation)
POST   /identity/connect-wallet   # Set wallet anchor for identity group
POST   /identity/dispute          # Dispute a merge
GET    /identity/group/:id        # Get identity group details (wallet-authenticated)
```

### Tracking

```
POST   /track/arrival             # Record referral arrival (creates touchpoint)
POST   /track/event               # Generic event (OpenPanel proxy)
```

### Webhooks (E-commerce)

```
POST   /webhook/shopify/:merchantId
POST   /webhook/woocommerce/:merchantId
POST   /webhook/custom/:merchantId
```

### Rewards

```
GET    /rewards/balance           # Get all balances (soft + hard)
GET    /rewards/claimable         # Get on-chain claimable (hard only)
GET    /rewards/history           # Transaction history
GET    /rewards/pending           # Get pending rewards (within clearance)
```

### Merchant (Dashboard)

```
GET    /merchant/config
PUT    /merchant/config
```

### Campaign Rules (JSON-based)

```
GET    /merchant/campaigns
POST   /merchant/campaigns
PUT    /merchant/campaigns/:id
DELETE /merchant/campaigns/:id
```

### Attribution Rules (JSON-based)

```
GET    /merchant/attribution-rules
POST   /merchant/attribution-rules
PUT    /merchant/attribution-rules/:id
DELETE /merchant/attribution-rules/:id
```

### Analytics

```
GET    /merchant/analytics/attribution    # Attribution breakdown
GET    /merchant/analytics/rewards        # Reward distribution stats
GET    /merchant/analytics/identity       # Identity merge stats
```

---

## Appendix C: Event Types

### Operational Events (PostgreSQL)

These events MUST be stored reliably - they trigger business logic.

```typescript
type OperationalEventType =
    | 'referral_arrival'     // User landed via referral link
    | 'wallet_connect'       // Wallet linked to identity group
    | 'purchase'             // Purchase completed (webhook)
    | 'account_create'       // New identity group created
    | 'identity_merge'       // Two identity groups merged
    | 'reward_created'       // Reward logged to ledger
    | 'reward_ready'         // Reward cleared for distribution
    | 'reward_settled'       // Reward pushed to blockchain
    | 'reward_claimed';      // User claimed on-chain
```

### Domain Event Bus

Internal events for domain decoupling:

```typescript
type DomainEvents = {
    // Identity
    'identity.created': { groupId: string; initialType: IdentityType; anonId: string };
    'identity.merged': { sourceGroupId: string; targetGroupId: string; mergedNodes: string[] };
    'identity.wallet_connected': { groupId: string; wallet: Address };
    'identity.disputed': { nodeId: string; newGroupId: string; reason: string };
    'identity.openpanel_synced': { groupId: string; openpanelProfileId: string };
    
    // Attribution
    'attribution.touchpoint_created': { touchpointId: string; source: TouchpointSource; groupId: string };
    'attribution.rule_matched': { ruleId: string; touchpointId: string; merchantId: string };
    'attribution.purchase_attributed': { purchaseId: string; touchpointId: string; referrer?: Address };
    
    // Campaigns
    'campaign.rule_matched': { ruleId: string; purchaseId: string; rewards: RewardDefinition[] };
    'campaign.budget_exhausted': { ruleId: string; budgetType: 'daily' | 'total' };
    
    // Rewards
    'reward.created': { assetLogId: string; amount: number; type: string; recipient: string };
    'reward.ready': { assetLogId: string };
    'reward.settled': { assetLogIds: string[]; txHash: string; blockNumber: number };
    'reward.claimed': { assetLogId: string; wallet: Address; txHash: string };
    
    // Fraud
    'fraud.self_referral_blocked': { buyerGroup: string; referrer: Address };
    'fraud.velocity_exceeded': { referrer: Address; count: number; window: string };
};
```

### Analytical Events (OpenPanel Only)

These events are fire-and-forget - system continues if they fail.

```typescript
type AnalyticalEventType =
    | 'page_view'            // Generic page navigation
    | 'add_to_cart'          // Unless triggers specific rule
    | 'button_click'         // UI interaction tracking
    | 'scroll_depth'         // Engagement metrics
    | 'session_start'        // Visit tracking
    | 'form_abandon'         // Funnel analysis
    | 'search_query'         // Search behavior
    | 'video_play';          // Media engagement
```

---

## Appendix D: SDK Anonymous ID Implementation

```typescript
/**
 * Generate a reproducible anonymous ID based on browser fingerprint.
 * The ID is unique per merchant to ensure privacy isolation.
 */

interface FingerprintComponents {
    userAgent: string;
    language: string;
    languages: string[];
    timezone: string;
    timezoneOffset: number;
    screenWidth: number;
    screenHeight: number;
    colorDepth: number;
    pixelRatio: number;
    platform: string;
    hardwareConcurrency: number;
    maxTouchPoints: number;
    // Optional: higher entropy components
    canvasHash?: string;
    webglVendor?: string;
    webglRenderer?: string;
}

function collectFingerprint(): FingerprintComponents {
    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: [...navigator.languages],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        canvasHash: getCanvasFingerprint(),
        webglVendor: getWebGLVendor(),
        webglRenderer: getWebGLRenderer(),
    };
}

function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Frak fingerprint', 2, 15);
        
        return canvas.toDataURL().slice(-50);  // Last 50 chars of base64
    } catch {
        return '';
    }
}

function getWebGLVendor(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '';
        
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return '';
        
        return (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    } catch {
        return '';
    }
}

function getWebGLRenderer(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '';
        
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return '';
        
        return (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    } catch {
        return '';
    }
}

async function generateAnonymousId(merchantId: string): Promise<string> {
    const storageKey = `frak_anon_${merchantId}`;
    
    // Check localStorage first
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    
    // Generate new ID from fingerprint
    const fingerprint = collectFingerprint();
    const data = JSON.stringify(fingerprint) + merchantId;
    
    // Use SubtleCrypto for consistent hashing
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const anonId = `anon_${hashHex.slice(0, 32)}`;
    
    // Persist to localStorage
    localStorage.setItem(storageKey, anonId);
    
    return anonId;
}

// Usage in SDK
export async function initFrakIdentity(config: { merchantId: string }) {
    const anonId = await generateAnonymousId(config.merchantId);
    
    // Sync with backend
    const response = await fetch('/api/identity/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId, merchantId: config.merchantId }),
    });
    
    const { identityGroupId } = await response.json();
    
    return { anonId, identityGroupId };
}
```

---

## Appendix E: Rule Engine TypeScript Types

### Campaign Rules

```typescript
// ============================================
// CAMPAIGN RULES
// ============================================

type CampaignTrigger = 
    | 'purchase'              // Any purchase event
    | 'referral_purchase'     // Purchase with attributed referral
    | 'signup'                // User registration
    | 'custom';               // Custom event type

type ConditionOperator = 
    | 'eq' | 'neq'            // Equality
    | 'gt' | 'gte'            // Greater than
    | 'lt' | 'lte'            // Less than
    | 'in' | 'not_in'         // Array membership
    | 'contains'              // String contains
    | 'exists';               // Field exists and is not null

interface RuleCondition {
    field: string;            // Dot-notation path: 'purchase.amount', 'user.is_new'
    operator: ConditionOperator;
    value: unknown;
}

type RewardRecipient = 'referrer' | 'referee' | 'buyer';

type RewardType = 
    | 'token'                 // Blockchain token (USDC, ETH)
    | 'discount'              // Percentage or fixed discount
    | 'points'                // Loyalty points
    | 'coupon';               // Coupon code

interface TokenReward {
    recipient: RewardRecipient;
    type: 'token';
    token: 'USDC' | 'ETH' | string;
    // Fixed amount OR percentage
    amount?: number;
    percent?: number;
    percentOf?: 'purchase_amount';
    // Caps
    maxAmount?: number;
    minAmount?: number;
}

interface DiscountReward {
    recipient: RewardRecipient;
    type: 'discount';
    amount: number;
    unit: 'percent' | 'fixed';
    // For fixed: currency
    currency?: string;
    // Caps
    maxAmount?: number;
}

interface PointsReward {
    recipient: RewardRecipient;
    type: 'points';
    amount: number;
    // Or percentage of purchase
    percent?: number;
    percentOf?: 'purchase_amount';
    // Points per dollar
    pointsPerUnit?: number;
}

interface CouponReward {
    recipient: RewardRecipient;
    type: 'coupon';
    couponPool: string;       // Reference to coupon pool
    // Or generate unique code
    generateUnique?: boolean;
}

type RewardDefinition = TokenReward | DiscountReward | PointsReward | CouponReward;

interface CampaignRule {
    trigger: CampaignTrigger;
    conditions?: RuleCondition[];
    rewards: RewardDefinition[];
}

interface CampaignBudget {
    daily?: number;
    total?: number;
    currency: string;
}
```

### Attribution Rules

```typescript
// ============================================
// ATTRIBUTION RULES
// ============================================

type TouchpointSource = 
    | 'referral_link'         // ?ref=0xWallet
    | 'organic_search'        // SEO traffic
    | 'paid_ad'               // UTM-tagged
    | 'social_share'          // Social media
    | 'email_campaign'        // Newsletter
    | 'direct';               // No attribution

type ConflictResolution = 
    | 'first_touch'           // Oldest touchpoint wins
    | 'last_touch'            // Newest touchpoint wins
    | 'highest_value'         // Highest-value source wins
    | 'linear';               // Split credit (future)

interface AttributionCondition {
    field: string;            // 'touchpoint.age_hours', 'touchpoint.source_data.campaign'
    operator: ConditionOperator;
    value: unknown;
}

interface AttributionRule {
    sources: TouchpointSource[];
    lookbackDays: number;
    conflictResolution: ConflictResolution;
    conditions?: AttributionCondition[];
    sourcePriority?: TouchpointSource[];  // For 'highest_value' resolution
}
```

### Validation Schemas (Zod)

```typescript
// ============================================
// VALIDATION SCHEMAS (Zod)
// ============================================

import { z } from 'zod';

const ConditionSchema = z.object({
    field: z.string().min(1),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'exists']),
    value: z.unknown(),
});

const TokenRewardSchema = z.object({
    recipient: z.enum(['referrer', 'referee', 'buyer']),
    type: z.literal('token'),
    token: z.string(),
    amount: z.number().positive().optional(),
    percent: z.number().min(0).max(100).optional(),
    percentOf: z.literal('purchase_amount').optional(),
    maxAmount: z.number().positive().optional(),
    minAmount: z.number().positive().optional(),
}).refine(
    data => data.amount !== undefined || data.percent !== undefined,
    { message: 'Either amount or percent must be specified' }
);

const DiscountRewardSchema = z.object({
    recipient: z.enum(['referrer', 'referee', 'buyer']),
    type: z.literal('discount'),
    amount: z.number().positive(),
    unit: z.enum(['percent', 'fixed']),
    currency: z.string().optional(),
    maxAmount: z.number().positive().optional(),
});

const PointsRewardSchema = z.object({
    recipient: z.enum(['referrer', 'referee', 'buyer']),
    type: z.literal('points'),
    amount: z.number().positive(),
    percent: z.number().min(0).max(100).optional(),
    percentOf: z.literal('purchase_amount').optional(),
    pointsPerUnit: z.number().positive().optional(),
});

const CouponRewardSchema = z.object({
    recipient: z.enum(['referrer', 'referee', 'buyer']),
    type: z.literal('coupon'),
    couponPool: z.string().optional(),
    generateUnique: z.boolean().optional(),
});

const RewardSchema = z.discriminatedUnion('type', [
    TokenRewardSchema,
    DiscountRewardSchema,
    PointsRewardSchema,
    CouponRewardSchema,
]);

export const CampaignRuleSchema = z.object({
    trigger: z.enum(['purchase', 'referral_purchase', 'signup', 'custom']),
    conditions: z.array(ConditionSchema).optional(),
    rewards: z.array(RewardSchema).min(1),
});

export const AttributionRuleSchema = z.object({
    sources: z.array(z.enum([
        'referral_link', 'organic_search', 'paid_ad', 
        'social_share', 'email_campaign', 'direct'
    ])).min(1),
    lookbackDays: z.number().int().min(1).max(365),
    conflictResolution: z.enum(['first_touch', 'last_touch', 'highest_value', 'linear']),
    conditions: z.array(ConditionSchema).optional(),
    sourcePriority: z.array(z.string()).optional(),
});

// Validate before storing
export function validateCampaignRule(rule: unknown): CampaignRule {
    return CampaignRuleSchema.parse(rule);
}

export function validateAttributionRule(rule: unknown): AttributionRule {
    return AttributionRuleSchema.parse(rule);
}
```

---

## Appendix F: Database Schema Summary

### Core Tables

```sql
-- Identity
identity_groups          -- The "human entity" container (wallet anchor)
identity_nodes           -- Individual identifiers (anon_id, customer_id, wallet)

-- Attribution  
touchpoints              -- Recorded arrival events (P2P referrals, UTM, etc.)
attribution_rules        -- JSON-based merchant attribution rules

-- Campaigns
campaign_rules           -- JSON-based reward rules (with optional touchpoint coupling)
asset_logs               -- Reward ledger (pending/ready/claimed, links to event_stream)

-- Events
event_stream             -- Operational events (immutable log)

-- Merchants
merchants                -- Merchant configuration
```

### Key Indexes

```sql
-- Identity resolution (hot path)
CREATE INDEX idx_identity_nodes_lookup ON identity_nodes(identity_type, identity_value, merchant_id);

-- Touchpoint attribution (hot path)  
CREATE INDEX idx_touchpoints_attribution ON touchpoints(identity_group_id, merchant_id, expires_at);

-- P2P referral queries
CREATE INDEX idx_touchpoints_referrer ON touchpoints((source_data->>'referrer_wallet'));

-- Settlement worker (batch job)
CREATE INDEX idx_assets_settlement ON asset_logs(status, claimable_at) WHERE status = 'pending';

-- Event → Reward traceability
CREATE INDEX idx_assets_events ON asset_logs USING GIN(event_stream_ids);

-- Event replay (debugging)
CREATE INDEX idx_event_stream_replay ON event_stream(merchant_id, occurred_at);
```

### Key Relationships

```
event_stream ──────┐
    (purchase)     │
                   ▼
              asset_logs ◄──── campaign_rules
                   │                 │
                   │                 │ (optional)
                   ▼                 ▼
              touchpoints ◄──── linked_touchpoint_*
                   │
                   ▼
           identity_groups
                   │
                   ▼
           identity_nodes (anon_id, wallet, customer_id)
```

---

*These appendices support the main [ARCHITECTURE-V2.md](./ARCHITECTURE-V2.md) document.*
