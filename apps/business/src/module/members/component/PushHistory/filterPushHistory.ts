import { endOfDay, startOfDay } from "date-fns";
import type { PushHistoryFilters } from "@/stores/pushHistoryStore";
import type { PushHistoryItem } from "./types";

/**
 * Apply the active history filters to the broadcast list.
 *
 * `status` is a multi-select (empty/absent = all). `dateRange` is matched
 * against each item's `scheduledAt`, inclusive on whole days. Kept pure so it
 * can move server-side later without changing the UI.
 */
export function filterPushHistory(
    items: PushHistoryItem[],
    filters: PushHistoryFilters
): PushHistoryItem[] {
    const { dateRange, status } = filters;
    // Hoisted out of the filter callback so the day boundaries are computed
    // once, not per item.
    const fromTime = dateRange?.from
        ? startOfDay(dateRange.from).getTime()
        : undefined;
    const toTime = dateRange?.to ? endOfDay(dateRange.to).getTime() : undefined;
    return items.filter((item) => {
        if (status && status.length > 0 && !status.includes(item.status)) {
            return false;
        }
        if (fromTime !== undefined && item.scheduledAt < fromTime) {
            return false;
        }
        if (toTime !== undefined && item.scheduledAt > toTime) {
            return false;
        }
        return true;
    });
}
