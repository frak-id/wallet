import { useMutation } from "@tanstack/react-query";
import type {
    DashboardActionParams,
    DashboardActionReturnType,
} from "../../core";
import { dashboardAction } from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

type DashboardActionHookParams = DashboardActionParams & {
    callback: (data: DashboardActionReturnType) => void;
};

/**
 * Trigger a dashboard action to the wallet
 */
export function useDashboardAction({
    action,
    params,
    callback,
}: DashboardActionHookParams) {
    const client = useNexusClient();

    return useMutation({
        mutationKey: [
            "dashboardActionMutationReturnTypeListener",
            action,
            params,
        ],
        mutationFn: async () => {
            if (!action) {
                return { key: "no-action" };
            }

            if (!client) {
                return { key: "waiting-response" };
            }

            // Setup the listener
            return await dashboardAction(client, { action, params }, callback);
        },
    });
}
