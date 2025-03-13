import { getCurrentReward } from "@/utils/getCurrentReward";
import type { Currency, FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { useEffect, useState } from "preact/hooks";

/**
 * Hook to fetch and format the current reward value for a given interaction
 * @param shouldUseReward - Flag to determine if reward should be fetched
 * @param targetInteraction - Optional interaction type to get specific reward for
 * @param currency - The currency to use for the reward (default is "eur")
 * @returns Object containing the formatted reward value in euros
 */
export function useReward(
    shouldUseReward: boolean,
    targetInteraction?: FullInteractionTypesKey,
    currency: Currency = "eur"
) {
    const [reward, setReward] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!shouldUseReward) return;

        getCurrentReward({ targetInteraction, currency }).then((reward) => {
            if (!reward) return;
            setReward(reward);
        });
    }, [shouldUseReward, targetInteraction, currency]);

    return { reward };
}
