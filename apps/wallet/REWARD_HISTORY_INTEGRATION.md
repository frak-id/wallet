# Wallet App: Reward History Integration

**Status**: Pending (requires backend endpoint first)
**Depends On**: `services/backend/ROUTES_CONSOLIDATION_PLAN.md` Phase 1
**Priority**: After backend `GET /user/rewards/history` endpoint is deployed

---

## Context

The wallet app currently shows reward history from the **indexer** (on-chain events: added/claimed). The new backend endpoint will provide **reward lifecycle** data (pending, processing, settled, etc.) with merchant context.

### Current Implementation

| File | Purpose |
|------|---------|
| `app/module/history/action/rewardHistory.ts` | Fetches from indexer API |
| `app/module/history/hook/useGetRewardHistory.ts` | TanStack Query hook |
| `app/module/history/component/RewardHistory/` | UI component |
| `app/routes/_wallet/_protected/history.tsx` | History page with tabs |

### Data Source Comparison

| Source | Data |
|--------|------|
| **Indexer** (current) | On-chain events: `added` + `claimed` with txHash, productId |
| **Backend** (new) | Lifecycle: `pending` → `processing` → `settled`, merchant info, trigger type |

---

## Integration Options

### Option A: Replace Indexer with Backend (Recommended)

Single source of truth from backend. Backend can include on-chain status.

**Files to modify:**
1. `app/module/history/action/rewardHistory.ts` - Switch to backend API
2. `app/module/history/component/RewardHistory/index.tsx` - Update UI for new fields

### Option B: Dual View (Tabs)

Keep both sources, show in separate tabs.

**Files to modify:**
1. `app/routes/_wallet/_protected/history.tsx` - Add third tab for "Reward Lifecycle"
2. Create new action/hook/component for backend data

### Option C: Merged View

Combine indexer + backend data into unified timeline.

**Complexity**: High (needs deduplication logic)

---

## Implementation (Option A)

### 1. Create Shared Hook in wallet-shared

> **Note**: This hook is shared between wallet and listener apps.
> See also: `apps/listener/REWARD_HISTORY_INTEGRATION.md`

```typescript
// packages/wallet-shared/src/common/queryKeys/rewards.ts
import type { Hex } from "viem";

export namespace rewardsKey {
    const base = "rewards" as const;
    export const baseKey = [base] as const;

    export const historyByAddress = (address?: Hex) =>
        [base, "history", address ?? "no-address"] as const;
}
```

```typescript
// packages/wallet-shared/src/tokens/hook/useGetRewardHistory.ts
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";

export function useGetRewardHistory() {
    const { address } = useAccount();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: rewardsKey.historyByAddress(address),
        queryFn: async () => {
            if (!address) return null;
            // No pagination for MVP (KISS) - returns all rewards
            const { data, error } = await authenticatedWalletApi.user.rewards.history.get();
            if (error) throw error;
            return data;
        },
        enabled: !!address,
    });

    return {
        rewards: data?.rewards ?? [],
        total: data?.rewards.length ?? 0,
        isLoading,
        error,
        refetch,
    };
}
```

```typescript
// packages/wallet-shared/src/tokens/index.ts
export { useGetUserBalance } from "./hook/useGetUserBalance";
export { useGetUserPendingBalance } from "./hook/useGetUserPendingBalance";
export { useGetRewardHistory } from "./hook/useGetRewardHistory"; // Add
export type { RewardHistoryItem } from "../types/history"; // Re-export type
```

### 2. Update Action (wallet app)

```typescript
// app/module/history/action/rewardHistory.ts
import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import type { HistoryGroup, RewardHistoryItem } from "@frak-labs/wallet-shared";
import { groupByDay } from "@/module/history/utils/groupByDay";

export async function getRewardHistory(): Promise<HistoryGroup<RewardHistoryItem>> {
    // No pagination for MVP (KISS) - returns all rewards
    const { data, error } = await authenticatedWalletApi.user.rewards.history.get();
    if (error) throw error;

    const finalArray = data.rewards.map((item) => ({
        id: item.id,
        amount: Number(item.amount) / 10 ** item.token.decimals,
        timestamp: new Date(item.earnedAt).getTime() / 1000,
        txHash: item.txHash ?? undefined,
        status: item.status,
        trigger: item.trigger,
        recipientType: item.recipientType,
        merchant: item.merchant,
        token: { symbol: item.token.symbol, decimals: item.token.decimals },
    }));

    return groupByDay(finalArray);
}
```

### 3. Update Component

```typescript
// app/module/history/component/RewardHistory/index.tsx
import type { RewardHistoryItem } from "@frak-labs/wallet-shared";

function RewardHistoryListItem({ reward }: { reward: RewardHistoryItem }) {
    const { t } = useTranslation();
    // Hook returns already-transformed amount (number)
    const amount = formatUsd(reward.amount);

    // Enhanced label based on status
    const statusLabel = {
        pending: t("common.pending"),
        processing: t("common.processing"),
        settled: t("common.claimable"),
        consumed: t("common.used"),
        cancelled: t("common.cancelled"),
        expired: t("common.expired"),
    }[reward.status];

    // Trigger label (null if not set)
    const triggerLabel = reward.trigger
        ? t(`trigger.${reward.trigger}`)
        : null;

    return (
        <>
            <div>
                <Title className={styles.reward__title}>
                    {reward.merchant.name}
                </Title>
                <span className={styles.reward__status}>{statusLabel}</span>
                {triggerLabel && (
                    <span className={styles.reward__trigger}>{triggerLabel}</span>
                )}
                <span className={styles.reward__date}>
                    {new Date(reward.timestamp * 1000).toLocaleString()}
                </span>
            </div>
            <div className={styles.reward__amount}>{amount}</div>
        </>
    );
}
```

### 4. Update Types

```typescript
// packages/wallet-shared/src/types/history.ts
export type RewardHistoryItem = {
    id: string;
    amount: number;           // Converted from BigInt string
    timestamp: number;        // Unix seconds
    txHash?: string;
    status: "pending" | "processing" | "settled" | "consumed" | "cancelled" | "expired";
    trigger: "referral" | "purchase" | "wallet_connect" | "identity_merge" | null;
    recipientType: "referrer" | "referee" | "user";
    merchant: { id: string; name: string; domain: string };
    token: { symbol: string; decimals: number };
};
```

---

## Dependencies

### Backend Endpoint Required

```
GET /user/rewards/history
```

> **Note**: Route is `/user/rewards/history` (not `/user/wallet/`) to support both authenticated wallet users AND anonymous SDK users.
> Anonymous SDK users are authenticated via `x-wallet-sdk-auth` (resolved via `walletSdkSession`).

Response shape (from ROUTES_CONSOLIDATION_PLAN.md):
```typescript
{
    rewards: Array<{
        id: string;
        amount: string;
        token: { address: Address; symbol: string; decimals: number };
        status: "pending" | "processing" | "settled" | "consumed" | "cancelled" | "expired";
        trigger: "referral" | "purchase" | "wallet_connect" | "identity_merge" | null;
        recipientType: "referrer" | "referee" | "user";
        merchant: { id: string; name: string; domain: string };
        earnedAt: string;
        settledAt?: string;
        txHash?: Hex;
    }>;
    // No pagination for MVP (KISS) - will add later if needed
}
```

### Eden Treaty Client Update

Add to `@frak-labs/wallet-shared`:
```typescript
// packages/wallet-shared/src/common/api/backendClient.ts
// Eden Treaty will auto-generate types from backend
authenticatedWalletApi.user.rewards.history.get({ query: { status } })  // No pagination for MVP
```

---

## i18n Keys to Add

```json
// packages/wallet-shared/src/i18n/locales/en/common.json
{
    "pending": "Pending",
    "processing": "Processing",
    "claimable": "Claimable",
    "used": "Used",
    "cancelled": "Cancelled",
    "expired": "Expired"
}

// packages/wallet-shared/src/i18n/locales/en/trigger.json (new)
{
    "referral": "Referral",
    "purchase": "Purchase",
    "wallet_connect": "Wallet Connect",
    "identity_merge": "Account Linked"
}
```

---

## Verification

- [ ] Backend endpoint deployed and accessible
- [ ] Eden Treaty types generated
- [ ] Shared hook added to wallet-shared (`useGetRewardHistory`)
- [ ] Query keys added (`rewardsKey.historyByAddress`)
- [ ] Action fetches from backend (not indexer)
- [ ] History displays new fields (status, trigger, merchant domain)
- [ ] All rewards returned (no pagination for MVP)
- [ ] Error states handled
- [ ] Loading states shown
- [ ] i18n translations added

---

## Notes

- Keep indexer fetch as fallback? Or remove entirely?
- Consider caching strategy (stale-while-revalidate)
- Mobile: ensure history page performance with large lists
