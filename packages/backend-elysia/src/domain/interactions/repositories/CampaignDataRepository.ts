import {
    type CampaignType,
    baseCampaignTriggerPtr,
    interactionCampaignAbi,
} from "@frak-labs/app-essentials";
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
import { getStorageAt, readContract } from "viem/actions";

export type TriggerData =
    | { baseReward: bigint }
    | { startReward: bigint; endReward: bigint };

type CampaignReward = {
    interactionTypeKey: FullInteractionTypesKey;
    triggerData: TriggerData;
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
                slotPerType: Object.entries(baseCampaignTriggerPtr).reduce(
                    (acc, [key, value]) => {
                        acc[key as CampaignType] = toHex(
                            hexToBigInt(value as Hex) |
                                BigInt(
                                    padHex(typeHash, { dir: "right", size: 32 })
                                )
                        );
                        return acc;
                    },
                    {} as Record<CampaignType, Hex>
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

        // Get the type of the given campaign
        const [type] = (await readContract(this.client, {
            abi: interactionCampaignAbi,
            address: campaign,
            functionName: "getMetadata",
        })) as [CampaignType, string, Hex];

        // Async mapping of the rewards
        const rewardsAsync = this.storagePtrs.map(async (storagePtr) => {
            // Find the right ptr to read at
            const slot = storagePtr.slotPerType[type];
            if (!slot) return null;

            // Find the trigger value
            const triggerValue = await getStorageAt(this.client, {
                address: campaign,
                slot,
                blockNumber: lastUpdateBlock,
            });
            // If that's 0, early exit
            if (!triggerValue) return null;
            const triggerData = this.extractTriggerDataFromStorage(
                type,
                triggerValue
            );
            if (!triggerData) return null;
            // Otherwise, add it to the cache
            return {
                interactionTypeKey: storagePtr.key,
                triggerData,
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
     * @param campaignType
     * @param storage
     * @private
     */
    private extractTriggerDataFromStorage(
        campaignType: CampaignType,
        storage: Hex
    ): TriggerData | undefined {
        if (!storage) return undefined;

        if (campaignType === "frak.campaign.affiliation-fixed") {
            // For storage layout `struct RewardTrigger { uint16 maxCountPerUser; uint240 baseReward; }`
            const baseReward = BigInt(sliceHex(storage, 0, 30));
            if (!baseReward) return undefined;
            return { baseReward };
        }
        if (campaignType === "frak.campaign.affiliation-range") {
            // For storage layout `struct RewardTrigger { uint16 maxCountPerUser; uint48 percentBeta; uint96 startReward; uint96 endReward; }`
            const endReward = BigInt(sliceHex(storage, 0, 12));
            const startReward = BigInt(sliceHex(storage, 12, 24));
            if (!(endReward && startReward)) return undefined;
            return { startReward, endReward };
        }
        if (campaignType === "frak.campaign.referral") {
            // For storage layout `struct RewardTrigger { uint192 baseReward; uint16 userPercent;  uint16 deperditionPerLevel; uint16 maxCountPerUser; }`
            const baseReward = BigInt(sliceHex(storage, 8, 32));
            if (!baseReward) return undefined;
            return { baseReward };
        }

        return undefined;
    }
}
