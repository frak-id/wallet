import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/module/explorer/component/ExplorerPage";
import {
    EXPLORER_DEFAULT_PAGE,
    explorerMerchantsQueryOptions,
} from "@/module/explorer/hook/useGetExplorerMerchants";

export const Route = createFileRoute("/_wallet/_protected/explorer")({
    component: ExplorerPage,
    // `ExplorerList` calls `useGetExplorerMerchants()` with no argument, so it
    // resolves the same `EXPLORER_DEFAULT_PAGE` the loader passes here — one
    // constant, so the two cannot drift into warming a key nothing reads.
    // `void prefetchQuery` keeps a failed/offline fetch from blocking or
    // rejecting the navigation; the hook renders its own loading/error state.
    loader: ({ context }) => {
        void context.queryClient.prefetchQuery(
            explorerMerchantsQueryOptions(EXPLORER_DEFAULT_PAGE)
        );
    },
});
