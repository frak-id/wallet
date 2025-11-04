import type { Budget } from "@/types/Campaign";

const capPeriods: Record<Budget, number> = {
    daily: 24 * 60 * 60,
    weekly: 7 * 24 * 60 * 60,
    monthly: 30 * 24 * 60 * 60,
    global: 281474976710655, // Max uint48
};

/**
 * Get the cap period for a given budget type
 * @param type
 */
export function getCapPeriod(type?: "" | Budget) {
    if (!type) return 0;
    return capPeriods[type] || 0;
}
