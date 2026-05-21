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

export const Route = createFileRoute("/_restricted/members")({
    loader: () => {
        const initialFilters = membersStore.getState().tableFilters;
        const isDemoMode = useAuthStore.getState().token === "demo-token";
        queryClient.prefetchQuery(
            membersPageQueryOptions(initialFilters, isDemoMode)
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
