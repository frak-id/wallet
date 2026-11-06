import { getClientIdAsync } from "../config/clientId";
import { getBackendUrl } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";
import type { RewardSummary } from "../types";
import { sdkVersionHeaders } from "../utils/sdkVersionHeader";

const FETCH_TIMEOUT_MS = 5000;

function isRewardSummary(value: unknown): value is RewardSummary {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<RewardSummary>;
    return (
        typeof candidate.linked === "boolean" &&
        (candidate.pending === null || typeof candidate.pending === "object") &&
        (candidate.earned === null || typeof candidate.earned === "object")
    );
}

/**
 * Fetch what the current visitor earned at this merchant: pending rewards, their
 * deadline, and whether their identity is already linked to a Frak wallet.
 *
 * Signs a `frak-rewards-v1` proof with this page's own key: the client id is public
 * (every share link carries it), so it never reads rewards on its own.
 *
 * @param params.merchantId - Defaults to `sdkConfigStore.resolveMerchantId()`
 * @returns The summary, or `null` without a client id, a key, a merchant, or on any failure
 */
export async function getRewardSummary({
    merchantId: explicitMerchantId,
}: {
    merchantId?: string;
} = {}): Promise<RewardSummary | null> {
    if (typeof window === "undefined") return null;

    const merchantId =
        explicitMerchantId ?? (await sdkConfigStore.resolveMerchantId());
    if (!merchantId) return null;

    const clientId = await getClientIdAsync().catch(() => undefined);
    if (!clientId) return null;

    const proof = await signProof({
        op: "frak-rewards-v1",
        merchantId,
        anonymousId: clientId,
    });
    if (!proof) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const url = new URL(`${getBackendUrl()}/user/merchant/rewards-summary`);
        url.searchParams.set("merchantId", merchantId);
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                "x-frak-client-id": clientId,
                "x-frak-proof": proof,
                ...sdkVersionHeaders(),
            },
        });
        if (!response.ok) return null;
        const data: unknown = await response.json();
        return isRewardSummary(data) ? data : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
