import { interactionTypes } from "@frak-labs/core-sdk";
import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { LRUCache } from "lru-cache";
import { sift } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    hexToBigInt,
    padHex,
    sliceHex,
    toHex,
} from "viem";
import { getStorageAt } from "viem/actions";

type CampaignReward = {
    interactionTypeKey: FullInteractionTypesKey;
    amount: bigint;
};

export class CampaignDataRepository {
    // Cache for the campaign rewards, no expiration
    private readonly campaignRewardsCache = new LRUCache<
        Address,
        CampaignReward[]
    >({
        max: 1024,
    });

    /**
     * Storage ptr for each reward trigger in the campaign contract
     *  - Store ptr: https://github.com/frak-id/contracts-v2/blob/3d086d956684ce15ca963e764d51af6427c9a462/src/campaign/ReferralCampaign.sol#L98
     */
    private readonly storagePtrs = Object.entries(interactionTypes).flatMap(
        ([key, subType]) =>
            Object.entries(subType).map(([subKey, typeHash]) => ({
                key: `${key}.${subKey}` as FullInteractionTypesKey,
                typeHash,
                storagePtr: toHex(
                    hexToBigInt(
                        "0x2b590e368f6e51c03042de6eb3d37f464929de3b3f869c37f1eb01ab"
                    ) | BigInt(padHex(typeHash, { dir: "right", size: 32 }))
                ),
            }))
    );

    constructor(private readonly client: Client<Transport, Chain>) {}

    /**
     * Get the campaign rewards
     * @param address
     */
    async getRewardsFromStorage({
        campaign,
        lastUpdateBlock,
    }: {
        campaign: Address;
        lastUpdateBlock?: bigint;
    }): Promise<CampaignReward[]> {
        const cached = this.campaignRewardsCache.get(campaign);
        if (cached) {
            return cached;
        }

        // Async mapping of the rewards
        const rewardsAsync = this.storagePtrs.map(async (storagePtr) => {
            // Find the trigger value
            const triggerValue = await getStorageAt(this.client, {
                address: campaign,
                slot: storagePtr.storagePtr,
                blockNumber: lastUpdateBlock,
            });
            // If that's 0, early exit
            if (!triggerValue) return null;
            const baseReward = this.extractBaseRewardFromStorage(triggerValue);
            if (!baseReward) return null;
            // Otherwise, add it to the cache
            return {
                interactionTypeKey: storagePtr.key,
                amount: baseReward,
            };
        });

        // Build our reward output
        const rewards: CampaignReward[] = sift(await Promise.all(rewardsAsync));

        // If no rewards, early exit
        if (!rewards.length) {
            this.campaignRewardsCache.set(campaign, []);
            return [];
        }

        // Return the final result
        this.campaignRewardsCache.set(campaign, rewards);
        return rewards;
    }

    /**
     * Extract the base reward from a storage ptr
     *  - Storage struct: https://github.com/frak-id/contracts-v2/blob/3d086d956684ce15ca963e764d51af6427c9a462/src/campaign/ReferralCampaign.sol#L86
     * @param storage
     * @private
     */
    private extractBaseRewardFromStorage(storage: Hex) {
        if (!storage) return undefined;
        const baseRewardHex = sliceHex(storage, 32 - 24, 32);
        const baseReward = BigInt(baseRewardHex);
        if (!baseReward) return undefined;
        return baseReward;
    }
}
