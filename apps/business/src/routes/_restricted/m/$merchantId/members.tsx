import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { TableMembers } from "@/module/members/component/TableMembers";
import { membersPageQueryOptions } from "@/module/members/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";
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
            })
        );
    },
    component: MembersListPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="members" />
    ),
});

function MembersListPage() {
    const { t } = useTranslation();
    return (
        <>
            <Head
                title={{ content: t("shell.nav.members") }}
                leftSection={
                    <Breadcrumb current={t("shell.breadcrumb.membersList")} />
                }
                rightSection={<ButtonSendPush />}
            />
            <TableMembers />
        </>
    );
}
