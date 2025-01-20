import {
    type CampaignType,
    baseCampaignTriggerPtr,
    campaignAbiForType,
    interactionCampaignAbi,
} from "@frak-labs/app-essentials";
import { interactionTypes } from "@frak-labs/core-sdk";
import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { LRUCache } from "lru-cache";
import { sift, tryit } from "radash";
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
    | { startReward: bigint; endReward: bigint; betaPercent: bigint };

type CampaignReward = {
    interactionTypeKey: FullInteractionTypesKey;
    triggerData: TriggerData;
};

export type CampaignRewardChainingConfig = {
    deperditionLevel: number;
    userPercent: number;
};

export class CampaignDataRepository {
    // Cache for the campaign type
    private readonly campaignTypeCache = new LRUCache<Address, CampaignType>({
        max: 1024,
    });

    // Cache for the campaign rewards, no expiration
    private readonly campaignRewardsCache = new LRUCache<
        Address,
        CampaignReward[]
    >({
        max: 1024,
    });

    // Cache for the campaign chaining config, no expiration
    private readonly campaignRewardChainingCache = new LRUCache<
        Address,
        CampaignRewardChainingConfig
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
     * Get a campaign type
     * @returns
     */
    async getType({
        campaign,
        lastUpdateBlock,
    }: {
        campaign: Address;
        lastUpdateBlock?: bigint;
    }): Promise<CampaignType> {
        const cached = this.campaignTypeCache.get(campaign);
        if (cached) {
            return cached;
        }

        const [type] = (await readContract(this.client, {
            abi: interactionCampaignAbi,
            address: campaign,
            functionName: "getMetadata",
            blockNumber: lastUpdateBlock,
        })) as [CampaignType, string, Hex];

        this.campaignTypeCache.set(campaign, type);
        return type;
    }

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
        const type = await this.getType({ campaign, lastUpdateBlock });

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
     * Get the reward chaining config for a campaign
     */
    async getChainingConfig({
        campaign,
        lastUpdateBlock,
    }: {
        campaign: Address;
        lastUpdateBlock?: bigint;
    }) {
        const cached = this.campaignRewardChainingCache.get(campaign);
        if (cached) {
            return cached;
        }

        const defaultChaining = {
            deperditionLevel: 0.8,
            userPercent: 0.5,
        };

        // Get the type of the given campaign
        const type = await this.getType({ campaign, lastUpdateBlock });
        const abi = campaignAbiForType[type];
        if (!abi) return defaultChaining;

        // Read the config on-chain
        const [, config] = await tryit(() =>
            readContract(this.client, {
                abi,
                address: campaign,
                functionName: "getConfig",
                blockNumber: lastUpdateBlock,
            })
        )();
        if (!config) return defaultChaining;

        // Check if the config contain the chaining reward (4 elements i nthe array theorically)
        const chaining = config[3];

        // If we have no chaining, consider it's defaulted to 50 / 80
        if (!chaining) {
            this.campaignRewardChainingCache.set(campaign, defaultChaining);
            return defaultChaining;
        }

        // Otherwise, extract the chaining config (on 10_000 basis)
        const extracted = {
            deperditionLevel: Number(chaining.deperditionPerLevel) / 10_000,
            userPercent: Number(chaining.userPercent) / 10_000,
        };
        this.campaignRewardChainingCache.set(campaign, extracted);
        return extracted;
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
            const betaPercent = BigInt(sliceHex(storage, 24, 30));
            if (!endReward || !startReward || !betaPercent) return undefined;
            return { startReward, endReward, betaPercent };
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
