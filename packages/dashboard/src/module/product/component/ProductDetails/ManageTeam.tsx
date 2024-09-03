import { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { Panel } from "@/module/common/component/Panel";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { toHex } from "viem";
import { TableTeam } from "../TableTeam";

/**
 * Component to manage a product team
 * @constructor
 */
export function ManageProductTeam({ productId }: { productId: bigint }) {
    const {
        data: administrators,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["product", "team", productId.toString()],
        queryFn: () =>
            getProductAdministrators({ productId: toHex(productId) }),
    });

    if (isLoading || isPending) {
        return (
            <Panel title={"Manage your team"}>
                <Spinner />
            </Panel>
        );
    }

    if (!administrators) {
        return (
            <Panel title={"Manage your team"}>
                <p>Could not load your team</p>
            </Panel>
        );
    }

    return (
        <Panel title={"Manage your team"}>
            {/* Display the administrators */}
            <TableTeam productId={productId} />
        </Panel>
    );
}
