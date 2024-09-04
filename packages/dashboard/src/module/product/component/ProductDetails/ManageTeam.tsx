import { Panel } from "@/module/common/component/Panel";
import type { Hex } from "viem";
import { TableTeam } from "../TableTeam";

/**
 * Component to manage a product team
 * @constructor
 */
export function ManageProductTeam({ productId }: { productId: Hex }) {
    return (
        <Panel title={"Manage your team"}>
            {/* Display the administrators */}
            <TableTeam productId={productId} />
        </Panel>
    );
}
