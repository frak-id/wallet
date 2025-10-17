import type { HistoryGroup } from "@frak-labs/wallet-shared/types/HistoryGroup";

/**
 * Group a list of items by day
 * @param data
 */
export function groupByDay<T extends { timestamp: number }>(
    data: T[]
): HistoryGroup<T> {
    const today = new Date();

    return (
        data
            // Sort every items per timestamp
            .sort((a, b) => b.timestamp - a.timestamp)
            // Then convert to history group
            .reduce(
                (acc, item) => {
                    const itemDate = new Date(item.timestamp * 1000);
                    const diffTime = today.getTime() - itemDate.getTime();
                    const diffDays = Math.floor(
                        diffTime / (1000 * 60 * 60 * 24)
                    );

                    let key: string;
                    if (diffDays === 0) {
                        key = "Today";
                    } else if (diffDays === 1) {
                        key = "Yesterday";
                    } else {
                        key = itemDate.toLocaleDateString();
                    }

                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(item);
                    return acc;
                },
                {} as { [key: string]: T[] }
            )
    );
}
