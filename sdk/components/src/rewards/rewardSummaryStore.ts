import {
    getClientId,
    type PendingRewardSummary,
    type RewardSummary,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import {
    getRewardSummary,
    REFERRAL_SUCCESS_EVENT,
} from "@frak-labs/core-sdk/actions";

export type RewardSummaryState = {
    status: "idle" | "loading" | "ready";
    summary: RewardSummary | null;
};

/** A claimable summary: nothing linked yet, and something waiting. */
export type ClaimableRewardSummary = RewardSummary & {
    linked: false;
    pending: PendingRewardSummary;
};

const CACHE_PREFIX = "frak-reward-summary-";
/** Something is waiting: it can be claimed, unlocked or paid any minute. */
const PENDING_TTL_MS = 10 * 60 * 1000;
/** Nothing waiting: only a referral invalidates, so a purchase or share shows up once this expires. */
const IDLE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { at: number; summary: RewardSummary };

let state: RewardSummaryState = { status: "idle", summary: null };
let inflight: Promise<RewardSummary | null> | null = null;
let generation = 0;
let invalidationBound = false;
let claimRefreshBound = false;
let claimStarted = false;
const listeners = new Set<() => void>();

function setState(next: RewardSummaryState) {
    state = next;
    for (const listener of listeners) listener();
}

function cacheKey(merchantId: string): string | undefined {
    const clientId = getClientId();
    return clientId ? `${CACHE_PREFIX}${merchantId}-${clientId}` : undefined;
}

function storageFor(summary: RewardSummary): Storage {
    return summary.pending ? window.sessionStorage : window.localStorage;
}

function readCache(merchantId: string): RewardSummary | null {
    const key = cacheKey(merchantId);
    if (!key) return null;
    for (const [storage, ttl] of [
        [window.sessionStorage, PENDING_TTL_MS],
        [window.localStorage, IDLE_TTL_MS],
    ] as const) {
        try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            const entry = JSON.parse(raw) as CacheEntry;
            if (Date.now() - entry.at < ttl) return entry.summary;
            storage.removeItem(key);
        } catch {
            // Unreadable or blocked storage: treat as a miss.
        }
    }
    return null;
}

function writeCache(merchantId: string, summary: RewardSummary) {
    const key = cacheKey(merchantId);
    if (!key) return;
    try {
        const entry: CacheEntry = { at: Date.now(), summary };
        storageFor(summary).setItem(key, JSON.stringify(entry));
    } catch {
        // Quota or blocked storage: the next page simply fetches again.
    }
}

function clearCache() {
    for (const storage of [window.sessionStorage, window.localStorage]) {
        try {
            const keys: string[] = [];
            for (let index = 0; index < storage.length; index++) {
                const key = storage.key(index);
                if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
            }
            for (const key of keys) storage.removeItem(key);
        } catch {
            // Blocked storage holds no cache to clear.
        }
    }
}

function bindInvalidation() {
    if (invalidationBound || typeof window === "undefined") return;
    invalidationBound = true;
    window.addEventListener(REFERRAL_SUCCESS_EVENT, invalidateRewardSummary);
}

function refreshAfterClaim() {
    if (!claimStarted || document.visibilityState === "hidden") return;
    claimStarted = false;
    invalidateRewardSummary();
}

function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) refreshAfterClaim();
}

/** A claim CTA was clicked: the next time the page is visible again the summary is refetched. */
export function markClaimStarted() {
    claimStarted = true;
    if (claimRefreshBound || typeof window === "undefined") return;
    claimRefreshBound = true;
    document.addEventListener("visibilitychange", refreshAfterClaim);
    window.addEventListener("pageshow", onPageShow);
}

/**
 * Load the visitor's reward summary once per page, through a session/local cache.
 * Failures are not cached: the next page asks again.
 */
export function loadRewardSummary(): Promise<RewardSummary | null> {
    bindInvalidation();
    if (state.status === "ready") return Promise.resolve(state.summary);
    if (inflight) return inflight;

    const currentGeneration = generation;
    setState({ status: "loading", summary: state.summary });
    inflight = (async () => {
        const merchantId = await sdkConfigStore.resolveMerchantId();
        const cached = merchantId ? readCache(merchantId) : null;
        const summary =
            cached ??
            (merchantId ? await getRewardSummary({ merchantId }) : null);
        // An invalidation landed mid-flight: its own reload owns cache and state now.
        if (currentGeneration === generation) {
            if (summary && merchantId && !cached) {
                writeCache(merchantId, summary);
            }
            setState({ status: "ready", summary });
        }
        return summary;
    })()
        .catch(() => {
            if (currentGeneration === generation) {
                setState({ status: "ready", summary: null });
            }
            return null;
        })
        .finally(() => {
            if (currentGeneration === generation) inflight = null;
        });
    return inflight;
}

/** Drop the cache after anything that can create or pay a reward; the next read refetches. */
export function invalidateRewardSummary() {
    generation += 1;
    inflight = null;
    clearCache();
    setState({ status: "idle", summary: state.summary });
}

export function getRewardSummaryState(): RewardSummaryState {
    return state;
}

export function subscribeRewardSummary(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function isExpired(expiresAt: string | null): boolean {
    return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
}

export function isClaimable(
    summary: RewardSummary | null | undefined
): summary is ClaimableRewardSummary {
    return (
        !!summary &&
        !summary.linked &&
        !!summary.pending &&
        summary.pending.count > 0 &&
        !isExpired(summary.pending.expiresAt)
    );
}

/** Test-only: forget the module state between cases. */
export function resetRewardSummaryStore() {
    generation += 1;
    inflight = null;
    claimStarted = false;
    state = { status: "idle", summary: null };
    listeners.clear();
}
