import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

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
 * Returns the first merchant they own; falls back to the first merchant
 * they admin; reports `empty` when neither is available so the caller can
 * decide what to show (typically: onboarding / empty dashboard).
 */
export async function resolveActiveMerchant(): Promise<ResolvedActiveMerchant> {
    const data = await queryClient.ensureQueryData(
        myMerchantsQueryOptions(isDemoMode())
    );
    const owned = data.owned ?? [];
    const adminOf = data.adminOf ?? [];
    const merchant = owned[0] ?? adminOf[0];
    if (!merchant) {
        return { status: "empty" };
    }
    return { status: "ok", merchant };
}
