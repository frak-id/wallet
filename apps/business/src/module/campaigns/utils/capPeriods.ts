export type BudgetType = "daily" | "weekly" | "monthly" | "global";

const capPeriods: Record<BudgetType, number | null> = {
    daily: 24 * 60 * 60,
    weekly: 7 * 24 * 60 * 60,
    monthly: 30 * 24 * 60 * 60,
    global: null, // Null for global budgets
};

/**
 * Get the cap period for a given budget type
 * @param type
 */
export function getCapPeriod(type?: "" | BudgetType | string) {
    if (!type) return 0;
    return capPeriods[type as BudgetType];
}

/** Inverse of {@link getCapPeriod}: derive the budget type from a duration. */
export function budgetTypeFromDuration(
    duration: number | null | undefined
): BudgetType {
    if (duration === capPeriods.daily) return "daily";
    if (duration === capPeriods.weekly) return "weekly";
    if (duration === capPeriods.monthly) return "monthly";
    return "global";
}

/** Human label stored on `BudgetConfigItem.label` (cosmetic; display is i18n-derived). */
export const BUDGET_TYPE_LABEL: Record<BudgetType, string> = {
    global: "Global",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
};
