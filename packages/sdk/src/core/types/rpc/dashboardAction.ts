/**
 * Parameters of the dashboard action
 */
export type DashboardActionParams = Readonly<{
    action: string;
    params: string;
}>;

/**
 * Return type of the dashboard action
 */
export type DashboardActionReturnType =
    | DashboardActionMissingAction
    | DashboardActionSuccessful;

type DashboardActionMissingAction = {
    key: "no-action";
    value?: never;
};

type DashboardActionSuccessful = {
    key: "action-successful";
    value?: string;
};
