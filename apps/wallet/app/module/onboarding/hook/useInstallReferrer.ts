import { IS_ANDROID, IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedBackendApi,
    clientIdStore,
    setInstallSource,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { onboardingKey } from "../queryKeys/onboarding";
import { getInstallReferrer } from "../utils/installReferrer";

type ReferrerData = {
    merchantId?: string;
    anonymousId?: string;
    merchant?: { name: string; domain: string };
    /**
     * `frak-install-v1` proof, when the sharer's SDK could sign at share
     * time. Optional — an old build's link or a legacy sharer never
     * carries one, and this arm must keep working without it.
     */
    proof?: string;
    /** A Frak/user referral code, riding the same Play referrer. */
    referralCode?: string;
};

/**
 * No merchant to ensure against, but a bare referral code (the
 * `/install?ref=` Play link, no `m`/`a`) still needs to reach the onboarding
 * step — return it alone, with no ensure action.
 */
function resolveCodeOnlyReferrer(
    referralCode: string | undefined
): ReferrerData | null {
    if (!referralCode) {
        trackEvent("install_referrer_missing", { reason: "missing_params" });
        return null;
    }
    trackEvent("install_referrer_resolved", {
        has_merchant: false,
        has_referrer_proof: false,
    });
    return { referralCode };
}

/**
 * Resolves merchant info, stores the pending ensure action + client ID, and
 * returns the full referrer data. Split out of `queryFn` to keep its
 * complexity under the lint budget.
 */
async function resolveMerchantReferrer(params: {
    merchantId: string;
    anonymousId: string;
    proof?: string;
    referralCode?: string;
}): Promise<ReferrerData> {
    const { merchantId, anonymousId, proof, referralCode } = params;
    const { data } = await authenticatedBackendApi.user.merchant.resolve.get({
        query: { merchantId },
    });
    const merchant = data
        ? { name: data.name, domain: data.domain }
        : undefined;

    trackEvent("install_referrer_resolved", {
        has_merchant: Boolean(merchant),
        has_referrer_proof: Boolean(proof),
    });
    setInstallSource("install_referrer");

    // Store ensure action (deduped, persisted, survives crashes). `proof` is
    // additive alongside the legacy pair — both arms travel together, same as
    // the direct-link path in `InstallProcessing`.
    pendingActionsStore.getState().addAction({
        type: "ensure",
        merchantId,
        anonymousId,
        merchant,
        ...(proof && { proof }),
    });
    // Exception to "clientIdStore is SDK-seeded": the Play referrer, in the
    // wallet app, is the one place this store is written from something else.
    clientIdStore.getState().setClientId(anonymousId);

    return { merchantId, anonymousId, merchant, proof, referralCode };
}

/**
 * On Tauri+Android, reads the Play Store install referrer, resolves merchant
 * info from the backend, and stores a pending ensure action + client ID.
 *
 * Mirrors what `useResolveInstallCode` does for the manual code flow.
 */
export function useInstallReferrer() {
    return useQuery<ReferrerData | null>({
        queryKey: onboardingKey.installReferrer,
        queryFn: async () => {
            trackEvent("install_referrer_checked");
            let referrer: string;
            try {
                const result = await getInstallReferrer();
                referrer = result.referrer;
            } catch (err) {
                trackEvent("install_referrer_failed", {
                    error_type: err instanceof Error ? err.name : "unknown",
                });
                throw err;
            }

            if (!referrer || referrer.length === 0) {
                trackEvent("install_referrer_missing", { reason: "empty" });
                return null;
            }

            const params = new URLSearchParams(referrer);
            const merchantId = params.get("merchantId");
            const anonymousId = params.get("anonymousId");
            // Additive read — an old sharing page's referrer has no `proof`
            // key, and URLSearchParams returns null for it as always.
            const proof = params.get("proof") ?? undefined;
            const referralCode = params.get("referralCode") ?? undefined;
            if (!merchantId || !anonymousId) {
                return resolveCodeOnlyReferrer(referralCode);
            }

            return resolveMerchantReferrer({
                merchantId,
                anonymousId,
                proof,
                referralCode,
            });
        },
        enabled: IS_TAURI && IS_ANDROID,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
        meta: { storable: false },
    });
}
