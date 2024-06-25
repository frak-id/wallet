import type {
    DashboardActionParams,
    DashboardActionReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useDashboardAction } from "@frak-labs/nexus-sdk/react";
import { useState } from "react";

export function useWallet({ action, params }: DashboardActionParams) {
    /**
     * The data returned from the wallet
     */
    const [data, setData] = useState<DashboardActionReturnType | null>(null);

    const { mutate: launchAction, isPending } = useDashboardAction({
        action,
        params,
        callback: setData,
    });

    return { data, launch: launchAction, isPending };
}
