import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import {
    type ProductScopeTarget,
    type RewardAudience,
    selectBestReward,
} from "@frak-labs/core-sdk/rewards";
import { useEffect, useState } from "preact/hooks";

/**
 * Hook to fetch and format the best reward for a given interaction type.
 *
 * Calls `getMerchantInformation`, picks the highest-value reward across all
 * matching live campaigns for the requested `audience` side, and returns it as
 * a formatted string.
 *
 * @param shouldUseReward - Whether to fetch the reward at all
 * @param targetInteraction - Optional filter by interaction type (e.g. "purchase")
 * @param audience - Reward side to display: `"referrer"` (default) or `"referee"`
 * @param product - The product currently on display, when known (e.g. a
 * product page). Purely advisory — see {@link ProductScopeTarget} and
 * `matchesProductScope` in `@frak-labs/core-sdk/rewards`; deprioritizes
 * non-matching `productScope`d campaigns, never changes anything when omitted.
 * @returns Object containing the formatted reward string, or undefined if unavailable
 */
export function useReward(
    shouldUseReward: boolean,
    targetInteraction?: InteractionTypeKey,
    audience?: RewardAudience,
    product?: ProductScopeTarget
) {
    const [reward, setReward] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!shouldUseReward) return;

        const client = window.FrakSetup?.client;
        if (!client) return;

        getMerchantInformation(client)
            .then((merchantInfo) => {
                const best = selectBestReward(merchantInfo.rewards, {
                    currency: client.config.metadata?.currency,
                    targetInteraction,
                    audience,
                    product,
                });
                // Percentage rewards carry no concrete amount to advertise
                // on this surface, so we treat them as "no reward" — callers
                // fall back to their no-reward copy.
                if (best && best.payoutType !== "percentage") {
                    setReward(best.formatted);
                }
            })
            .catch(() => {
                // Silently swallow — reward text is non-critical
            });
    }, [shouldUseReward, targetInteraction, audience, product]);

    return { reward };
}
