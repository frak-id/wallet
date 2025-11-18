import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { TableMembers } from "@/module/members/component/TableMembers";
import { membersPageQueryOptions } from "@/module/members/queries/queryOptions";
import { membersStore } from "@/stores/membersStore";

export const Route = createFileRoute("/_restricted/members")({
    // Prefetch first page of members
    loader: () => {
        const initialFilters = membersStore.getState().tableFilters;
        return queryClient.ensureQueryData(
            membersPageQueryOptions(initialFilters)
        );
    },
    component: MembersListPage,
    pendingComponent: () => <Spinner />,
});

function MembersListPage() {
    return (
        <>
            <Head
                title={{ content: "Members" }}
                leftSection={<Breadcrumb current={"Members List"} />}
                rightSection={<ButtonSendPush />}
            />
            <TableMembers />
        </>
    );
}
