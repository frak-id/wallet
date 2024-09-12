import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { TableMembers } from "@/module/members/component/TableMembers";

export default function MembersListPage() {
    return (
        <>
            <Head
                title={{ content: "Members" }}
                leftSection={<Breadcrumb current={"Members List"} />}
            />
            <TableMembers />
        </>
    );
}
