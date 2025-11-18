import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { TableMembers } from "@/module/members/component/TableMembers";
import { membersPageQueryOptions } from "@/module/members/queries/queryOptions";
import { membersStore } from "@/stores/membersStore";

export const Route = createFileRoute("/members")({
    beforeLoad: requireAuth,
    // Prefetch first page of members
    loader: () => {
        const initialFilters = membersStore.getState().tableFilters;
        return queryClient.ensureQueryData(
            membersPageQueryOptions(initialFilters)
        );
    },
    component: MembersListPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function MembersListPage() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Members" }}
                leftSection={<Breadcrumb current={"Members List"} />}
                rightSection={<ButtonSendPush />}
            />
            <TableMembers />
        </RestrictedLayout>
    );
}
