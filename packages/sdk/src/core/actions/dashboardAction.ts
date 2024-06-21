import type {
    DashboardActionParams,
    DashboardActionReturnType,
    NexusClient,
} from "../types";

/**
 * Function used to watch a dashboard action
 * @param client
 * @param action
 * @param callback
 */
export function dashboardAction(
    client: NexusClient,
    { action }: DashboardActionParams,
    callback: (status: DashboardActionReturnType) => void
) {
    return client.listenerRequest(
        {
            method: "frak_listenToDashboardAction",
            params: [action],
        },
        callback
    );
}
