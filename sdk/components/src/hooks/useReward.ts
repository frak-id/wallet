import { getCurrentReward } from "@/utils/getCurrentReward";
import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { useEffect, useState } from "preact/hooks";

/**
 * Hook to fetch and format the current reward value for a given interaction
 * @param shouldUseReward - Flag to determine if reward should be fetched
 * @param targetInteraction - Optional interaction type to get specific reward for
 * @returns Object containing the formatted reward value in euros
 */
export function useReward(
    shouldUseReward: boolean,
    targetInteraction?: FullInteractionTypesKey
) {
    const [reward, setReward] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!shouldUseReward) return;

        getCurrentReward(targetInteraction).then((reward) => {
            if (!reward) return;
            setReward(`${reward}€`);
        });
    }, [shouldUseReward, targetInteraction]);

    return { reward };
}
