import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { TableTeam } from "../TableTeam";

export function Team({ merchantId }: { merchantId: string }) {
    return (
        <FormLayout>
            <Panel title={"Manage your team"}>
                {/* Display the administrators */}
                <TableTeam merchantId={merchantId} />
            </Panel>
        </FormLayout>
    );
}
