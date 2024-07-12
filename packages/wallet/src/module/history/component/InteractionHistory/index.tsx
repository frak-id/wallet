"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { Interaction } from "@/module/history/component/Interaction";
import { useGetInteractionHistory } from "@/module/history/hook/useGetInteractionHistory";

export function InteractionHistory() {
    const { history } = useGetInteractionHistory();

    if (!history) return <Skeleton count={3} height={110} />;

    return history?.map((historyItem) => (
        <Interaction key={historyItem.timestamp} article={historyItem} />
    ));
}
