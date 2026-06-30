import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { authenticatedBackendApi, recordError } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

const explorerDetailKeys = {
    detail: (merchantId?: string) =>
        ["explorer", "detail", merchantId] as const,
};

// Backend caps `explore` at 100 results per page (see explorer.ts).
const PAGE_SIZE = 100;

/**
 * Resolves a single {@link ExplorerMerchantItem} by id for the
 * `/explorer/$merchantId` deep link (used by campaign-launch notifications).
 *
 * TODO: This walks the paginated `explore` list to find the merchant because
 * there is no "get explorer merchant by id" endpoint yet. Add a backend
 * `GET /user/merchant/explore/:id` (single `ExplorerMerchantItem`, reusing the
 * ExplorerOrchestrator query with an `eq(id)` filter) and replace this paging
 * loop with a single request. The current approach can only find merchants that
 * are explorer-listed AND within the walked pages, and it cannot open the modal
 * for a merchant that is not explorer-eligible.
 */
export function useGetExplorerMerchantById(merchantId?: string) {
    const { data, isSuccess, isError, error } = useQuery({
        queryKey: explorerDetailKeys.detail(merchantId),
        enabled: !!merchantId,
        queryFn: async (): Promise<ExplorerMerchantItem | null> => {
            let offset = 0;
            while (true) {
                const { data: page, error: pageError } =
                    await authenticatedBackendApi.user.merchant.explore.get({
                        query: { limit: PAGE_SIZE, offset },
                    });
                if (pageError) {
                    recordError(pageError, {
                        source: "deep_link",
                        context: { feature: "explorer", merchantId },
                    });
                    throw pageError;
                }

                const found = page.merchants.find((m) => m.id === merchantId);
                if (found) return found;

                offset += PAGE_SIZE;
                if (offset >= page.totalResult) return null;
            }
        },
    });

    return {
        merchant: data ?? null,
        // Settled = the lookup finished (resolved with a merchant, resolved with
        // null/not-found, or errored). Derived from query status — NOT from
        // `isLoading`, which is briefly false during the idle window before data
        // attaches and would fire the route effect with no merchant.
        isSettled: isSuccess || isError,
        error,
    };
}
