import type { HistoryGroup } from "@frak-labs/wallet-shared";

type GroupByDayOptions = {
    locale: string;
    todayLabel: string;
    yesterdayLabel: string;
};

/**
 * Group a list of items by day with localized date headers
 */
export function groupByDay<T extends { timestamp: number }>(
    data: T[],
    { locale, todayLabel, yesterdayLabel }: GroupByDayOptions
): HistoryGroup<T> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return data
        .sort((a, b) => b.timestamp - a.timestamp)
        .reduce<HistoryGroup<T>>((acc, item) => {
            const itemDate = new Date(item.timestamp * 1000);

            let key: string;
            if (itemDate.toDateString() === today.toDateString()) {
                key = todayLabel;
            } else if (itemDate.toDateString() === yesterday.toDateString()) {
                key = yesterdayLabel;
            } else {
                key = itemDate.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "long",
                });
            }

            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        }, {});
}
