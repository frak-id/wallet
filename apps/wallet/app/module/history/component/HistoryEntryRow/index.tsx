import { MoneriumOrderHistoryItem } from "@/module/history/component/MoneriumOrderHistoryItem";
import { RewardHistoryItem } from "@/module/history/component/RewardHistory";
import type { HistoryEntry } from "@/module/history/utils/historyEntry";

/**
 * Dispatcher that picks the right row component for a unified history
 * entry. Kept deliberately thin so `groupByDay` / `HistoryDayGroup` can
 * keep operating on a single list shape.
 */
export function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
    if (entry.kind === "reward") {
        return <RewardHistoryItem item={entry.reward} />;
    }
    return <MoneriumOrderHistoryItem order={entry.order} />;
}
