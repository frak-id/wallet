# Listener App: Reward History Integration

**Status**: Pending (requires backend endpoint first)
**Depends On**: `services/backend/ROUTES_CONSOLIDATION_PLAN.md` Phase 1
**Priority**: After backend `GET /user/rewards/history` endpoint is deployed

---

## Context

The listener app (embedded wallet iframe) currently shows **balance only**. Adding reward history would let users see their earning activity without leaving the partner site.

### Current Implementation

| File | Purpose |
|------|---------|
| `app/module/embedded/component/WalletLoggedIn/` | Shows balance + action buttons |
| `app/module/embedded/component/Wallet/` | Main embedded wallet container |
| `packages/wallet-shared/src/tokens/hook/useGetUserBalance.ts` | Balance from backend |
| `packages/wallet-shared/src/tokens/hook/useGetUserPendingBalance.ts` | Pending balance from backend |

### Current UX

```
┌─────────────────────────────┐
│  Balance: $12.50            │
│  (pending)                  │
│                             │
│  [Activate] [Copy] [Share]  │
│                             │
│  Origin pairing status      │
└─────────────────────────────┘
```

---

## Proposed UX

### Option A: Expandable History Section

Add collapsible history below balance.

```
┌─────────────────────────────┐
│  Balance: $12.50            │
│                             │
│  [Activate] [Copy] [Share]  │
│                             │
│  ▼ Recent Rewards (3)       │
│  ├─ +$2.00 from referral    │
│  ├─ +$5.00 from purchase    │
│  └─ +$5.50 pending          │
│                             │
│  Origin pairing status      │
└─────────────────────────────┘
```

### Option B: Tab View

Add tabs to switch between balance and history.

```
┌─────────────────────────────┐
│  [Balance] [History]        │
│  ─────────────────────────  │
│  +$2.00  Referral  2h ago   │
│  +$5.00  Purchase  1d ago   │
│  +$5.50  Pending   3d ago   │
│                             │
│  Origin pairing status      │
└─────────────────────────────┘
```

### Recommendation: Option A

Keeps balance visible (primary info), history is secondary.

---

## Implementation

### 1. Shared Hook (from wallet-shared)

> **Note**: Hook is defined in wallet-shared and shared with wallet app.
> See: `apps/wallet/REWARD_HISTORY_INTEGRATION.md` for hook implementation.

```typescript
// Usage in listener
import { useGetRewardHistory } from "@frak-labs/wallet-shared";

const { rewards, total, isLoading, refetch } = useGetRewardHistory();
```

### 2. Create History Component

```typescript
// apps/listener/app/module/embedded/component/RewardHistory/index.tsx
import { formatAmount, type Currency } from "@frak-labs/core-sdk";
import { useGetRewardHistory, type RewardHistoryItem } from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import { useState } from "react";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import styles from "./index.module.css";

type Props = {
    currency: Currency;
};

export function RewardHistorySection({ currency }: Props) {
    const { t } = useListenerTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    // Show only first 5 rewards in embedded view (slice client-side)
    const { rewards, total, isLoading } = useGetRewardHistory();
    const displayRewards = rewards.slice(0, 5);

    if (isLoading || rewards.length === 0) return null;

    return (
        <div className={styles.historySection}>
            <button
                type="button"
                className={styles.historyToggle}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span>{isExpanded ? "▼" : "▶"}</span>
                <span>{t("rewards.recentRewards", { count: total })}</span>
            </button>

            {isExpanded && (
                <ul className={styles.historyList}>
                    {displayRewards.map((reward) => (
                        <RewardHistoryListItem
                            key={reward.id}
                            reward={reward}
                            currency={currency}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function RewardHistoryListItem({
    reward,
    currency,
}: {
    reward: RewardHistoryItem;
    currency: Currency;
}) {
    const { t } = useListenerTranslation();
    // Hook returns already-transformed amount (number)
    const formattedAmount = formatAmount(reward.amount, currency);
    const triggerLabel = reward.trigger ? t(`trigger.${reward.trigger}`) : null;
    // Hook returns timestamp in seconds
    const timeAgo = formatTimeAgo(new Date(reward.timestamp * 1000));

    const statusClass = {
        pending: styles.statusPending,
        processing: styles.statusProcessing,
        settled: styles.statusSettled,
        cancelled: styles.statusCancelled,
        expired: styles.statusCancelled,
    }[reward.status] ?? "";

    return (
        <li className={cx(styles.historyItem, statusClass)}>
            <span className={styles.historyAmount}>+{formattedAmount}</span>
            {triggerLabel && <span className={styles.historyTrigger}>{triggerLabel}</span>}
            <span className={styles.historyTime}>{timeAgo}</span>
        </li>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
```

### 3. Add Styles

```css
/* apps/listener/app/module/embedded/component/RewardHistory/index.module.css */
.historySection {
    margin-top: 12px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
}

.historyToggle {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
    width: 100%;
    text-align: left;
}

.historyList {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
}

.historyItem {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 12px;
    border-bottom: 1px solid var(--color-border-light);
}

.historyItem:last-child {
    border-bottom: none;
}

.historyAmount {
    font-weight: 600;
    color: var(--color-success);
}

.historyTrigger {
    color: var(--color-text-secondary);
    flex: 1;
    margin-left: 8px;
}

.historyTime {
    color: var(--color-text-muted);
    font-size: 11px;
}

.statusPending {
    opacity: 0.7;
}

.statusPending .historyAmount {
    color: var(--color-warning);
}

.statusProcessing {
    opacity: 0.8;
}

.statusCancelled {
    text-decoration: line-through;
    opacity: 0.5;
}
```

### 4. Integrate into WalletLoggedIn

```typescript
// apps/listener/app/module/embedded/component/WalletLoggedIn/index.tsx
import { RewardHistorySection } from "@/module/embedded/component/RewardHistory";

export function LoggedInComponent() {
    const {
        currentRequest: { configMetadata },
    } = useEmbeddedListenerUI();
    // ... existing code ...

    return (
        <>
            <Balance
                amount={amount}
                isPending={isPending}
                currency={configMetadata?.currency ?? "eur"}
            />
            <ActionButtons refetchPendingBalance={refetchPendingBalance} />
            {/* Add history section */}
            <RewardHistorySection currency={configMetadata?.currency ?? "eur"} />
            {footer}
        </>
    );
}
```

---

## Dependencies

### Backend Endpoint Required

```
GET /user/rewards/history
```

> **Note**: Route is `/user/rewards/history` (not `/user/wallet/`) to support both authenticated wallet users AND anonymous SDK users (via `x-wallet-sdk-auth` header).

Must be deployed before this integration.

### wallet-shared Changes

See `apps/wallet/REWARD_HISTORY_INTEGRATION.md` for:
1. `useGetRewardHistory` hook implementation
2. `RewardHistoryItem` type (already transformed data)
3. `rewardsKey` query key factory
4. Barrel exports

---

## i18n Keys to Add

```json
// Listener uses its own i18n namespace
// apps/listener translations or packages/wallet-shared/src/i18n/locales/

{
    "rewards": {
        "recentRewards": "Recent Rewards ({{count}})"
    },
    "trigger": {
        "referral": "Referral",
        "purchase": "Purchase",
        "wallet_connect": "Wallet Connect",
        "identity_merge": "Account Linked"
    }
}
```

---

## Bundle Size Considerations

The listener app is iframe-embedded, bundle size is critical.

- Hook reuses existing TanStack Query
- Minimal component (~50 lines)
- CSS is scoped, minimal
- No new dependencies

Estimated impact: **< 2KB gzipped**

---

## Verification

- [ ] Backend endpoint deployed
- [ ] Shared hook available from wallet-shared (see wallet doc)
- [ ] Component renders in embedded wallet
- [ ] Expandable section works
- [ ] Rewards display correctly
- [ ] Pending/settled status styled differently
- [ ] Time ago formatting works
- [ ] No layout shift when expanded
- [ ] Bundle size impact acceptable

---

## Future Enhancements

1. **Pull to refresh** - Swipe down to refresh history
2. **See all link** - Deep link to full history in wallet app
3. **Filters** - Show only pending, only from this site
4. **Animations** - Smooth expand/collapse
