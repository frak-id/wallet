import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";
import { activeMerchantStore } from "@/stores/activeMerchantStore";

type ResolvedMerchantSummary = {
    id: string;
    name: string;
    domain: string;
};

export type ResolvedActiveMerchant =
    | {
          status: "ok";
          merchant: ResolvedMerchantSummary;
      }
    | { status: "empty" };

/**
 * Resolves the user's "active" merchant for use by legacy redirect routes.
 *
 * Prefers the merchant they were last working in (if still accessible);
 * otherwise returns the first merchant they own, falling back to the first
 * they admin; reports `empty` when neither is available so the caller can
 * decide what to show (typically: onboarding / empty dashboard).
 */
export async function resolveActiveMerchant(): Promise<ResolvedActiveMerchant> {
    const data = await queryClient.ensureQueryData(
        myMerchantsQueryOptions(isDemoMode())
    );
    const owned = data.owned ?? [];
    const adminOf = data.adminOf ?? [];
    const { lastMerchantId } = activeMerchantStore.getState();
    const remembered = [...owned, ...adminOf].find(
        (m) => m.id === lastMerchantId
    );
    const merchant = remembered ?? owned[0] ?? adminOf[0];
    if (!merchant) {
        return { status: "empty" };
    }
    return { status: "ok", merchant };
}
