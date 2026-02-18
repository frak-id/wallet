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
