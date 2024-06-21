/**
 * Parameters of the dashboard action
 */
export type DashboardActionParams = Readonly<{
    action: string;
}>;

/**
 * Return type of the dashboard action
 */
export type DashboardActionReturnType =
    | DashboardActionMissingAction
    | DashboardActionSuccessful;

type DashboardActionMissingAction = {
    key: "no-action";
};

type DashboardActionSuccessful = {
    key: "action-successful";
};
