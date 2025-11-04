import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { TableMembers } from "@/module/members/component/TableMembers";

export const Route = createFileRoute("/members")({
    beforeLoad: requireAuth,
    component: MembersListPage,
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
