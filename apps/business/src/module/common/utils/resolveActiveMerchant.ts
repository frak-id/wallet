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
 * Prefers the merchant they were last working in (if still visible);
 * otherwise returns the first merchant they own, falling back to the first
 * they admin, then to a read-only merchant a platform admin can view;
 * reports `empty` when none is available so the caller can decide what to
 * show (typically: onboarding / empty dashboard).
 */
export async function resolveActiveMerchant(): Promise<ResolvedActiveMerchant> {
    const data = await queryClient.ensureQueryData(
        myMerchantsQueryOptions(isDemoMode())
    );
    const owned = data.owned ?? [];
    const adminOf = data.adminOf ?? [];
    // Read-only merchants a platform admin can view but not manage. Included
    // so an admin with no merchants of their own still lands on a workspace
    // instead of the onboarding empty state.
    const readOnly = data.allMerchants ?? [];
    const { lastMerchantId } = activeMerchantStore.getState();
    const remembered = [...owned, ...adminOf, ...readOnly].find(
        (m) => m.id === lastMerchantId
    );
    const merchant = remembered ?? owned[0] ?? adminOf[0] ?? readOnly[0];
    if (!merchant) {
        return { status: "empty" };
    }
    return { status: "ok", merchant };
}
