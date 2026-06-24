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
    return items.filter((item) => {
        if (status && status.length > 0 && !status.includes(item.status)) {
            return false;
        }
        if (
            dateRange?.from &&
            item.scheduledAt < startOfDay(dateRange.from).getTime()
        ) {
            return false;
        }
        if (
            dateRange?.to &&
            item.scheduledAt > endOfDay(dateRange.to).getTime()
        ) {
            return false;
        }
        return true;
    });
}
