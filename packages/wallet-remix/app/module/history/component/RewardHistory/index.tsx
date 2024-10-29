"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { Reward } from "@/module/history/component/Reward";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";

export function RewardHistory() {
    const { history } = useGetRewardHistory();

    if (!history) return <Skeleton count={3} height={110} />;

    return history?.map((rewardItem, index) => (
        <Reward
            key={`${rewardItem.timestamp}-${rewardItem.type}-${index}`}
            reward={rewardItem}
        />
    ));
}
