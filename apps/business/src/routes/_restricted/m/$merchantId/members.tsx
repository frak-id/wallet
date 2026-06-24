import { createFileRoute } from "@tanstack/react-router";
import * as footerStyles from "@/module/common/component/FloatingFooter/floating-footer.css";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MembersSectionTabs } from "@/module/members/component/MembersSectionTabs";
import { TableMembers } from "@/module/members/component/TableMembers";
import { MembersListFooter } from "@/module/members/component/TableMembers/MembersListFooter";
import { membersPageQueryOptions } from "@/module/members/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";
import { currencyStore } from "@/stores/currencyStore";
import { membersStore } from "@/stores/membersStore";

export const Route = createFileRoute("/_restricted/m/$merchantId/members")({
    loader: ({ params }) => {
        // Members are always scoped to the active URL merchant — the
        // scoping lives inside `membersPageQueryOptions` so prefetches
        // and hover-preloads can't mutate the currently-viewed list's
        // filter. We still read `tableFilters` for non-merchant filters
        // (date range, interactions, etc.) the user has set. Pagination
        // is reset to page 1 in-loader because a previous merchant's
        // offset doesn't carry over to a different dataset; the actual
        // store reset happens in the rendered `TableMembers` component
        // so hover-preloads don't mutate the currently-viewed list.
        const isDemoMode = useAuthStore.getState().token === "demo-token";
        const filters = {
            ...membersStore.getState().tableFilters,
            offset: 0,
        };
        queryClient.prefetchQuery(
            membersPageQueryOptions({
                merchantId: params.merchantId,
                filters,
                isDemoMode,
                currency: currencyStore.getState().preferredCurrency,
            })
        );
    },
    component: MembersListPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="members" />
    ),
});

function MembersListPage() {
    const { merchantId } = Route.useParams();
    return (
        <div className={footerStyles.pageBottomSpacer}>
            <PageShell page="members" space="l">
                <MembersSectionTabs active="members" merchantId={merchantId} />
                <TableMembers />
            </PageShell>
            <MembersListFooter />
        </div>
    );
}
