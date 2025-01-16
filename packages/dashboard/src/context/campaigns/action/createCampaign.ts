"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { getBankTokenInfo } from "@/context/campaigns/action/getBankInfo";
import type { DraftCampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getCapPeriod } from "@/context/campaigns/utils/capPeriods";
import {
    affiliationRangeCampaignConfigStruct,
    affiliationRangeCampaignId,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import {
    addresses,
    productInteractionManagerAbi,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import {
    type InteractionTypesKey,
    interactionTypes,
} from "@frak-labs/core-sdk";
import { ObjectId } from "mongodb";
import { first } from "radash";
import {
    type Hex,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    isAddress,
    parseAbi,
    parseEventLogs,
    parseUnits,
} from "viem";
import { getTransactionReceipt, simulateContract } from "viem/actions";

/**
 * Save a campaign draft
 * @param campaign
 */
export async function saveCampaignDraft(
    campaign: Partial<Campaign>
): Promise<{ id?: string }> {
    const currentSession = await getSafeSession();

    // Build the partial document
    const draftDocument: DraftCampaignDocument = {
        ...campaign,
        creator: currentSession.wallet,
        state: {
            key: "draft",
        },
    };

    // Insert it
    const repository = await getCampaignRepository();
    const finalDraft = await repository.upsertDraft(draftDocument);
    return {
        id: finalDraft?._id?.toHexString(),
    };
}

/**
 * Function to create a new campaign
 * @param campaign
 */
export async function getCreationData(campaign: Campaign) {
    const session = await getSafeSession();

    if (!campaign.productId) {
        throw new Error("Product id is required");
    }

    // If the triggers record is empty early exit
    if (!campaign.triggers || Object.keys(campaign.triggers).length === 0) {
        throw new Error("Triggers are required");
    }

    // If the bank address isn't set, early exit
    if (!(campaign.bank && isAddress(campaign.bank))) {
        throw new Error("Bank is required");
    }

    // Compute the cap period
    const capPeriod = getCapPeriod(campaign.budget.type);

    // The start and end period
    let start = 0;
    let end = 0;
    if (campaign.scheduled?.dateStart) {
        start = Math.floor(
            new Date(campaign.scheduled.dateStart).getTime() / 1000
        );
    }
    if (campaign.scheduled?.dateEnd) {
        end = Math.floor(new Date(campaign.scheduled.dateEnd).getTime() / 1000);
    }

    // Get the token decimal count
    const { decimals: tokenDecimals } = await getBankTokenInfo({
        bank: campaign.bank,
    });
    const triggers = extractTriggers(campaign, tokenDecimals);

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(
        affiliationRangeCampaignConfigStruct,
        [
            stringToBytes32(campaign.title),
            campaign.bank,
            // Cap config
            {
                period: capPeriod,
                amount: campaign.budget.maxEuroDaily
                    ? parseUnits(
                          campaign.budget.maxEuroDaily.toString(),
                          tokenDecimals
                      )
                    : 0n,
            },
            // Activation period
            { start, end },
            // reward chaining config
            {
                userPercent: campaign?.rewardChaining?.userPercent
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.userPercent * 10_000
                          )
                      )
                    : 5_000n, // default to 50%
                deperditionPerLevel: campaign?.rewardChaining
                    ?.deperditionPerLevel
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.deperditionPerLevel *
                                  10_000
                          )
                      )
                    : 8_000n, // default to 80%
            },
            // Triggers
            triggers,
        ]
    );
    // Add offset to the data
    const initDataWithOffset = concatHex([
        "0x0000000000000000000000000000000000000000000000000000000000000020",
        campaignInitData,
    ]);

    // Perform a contract simulation
    //  this will fail if the tx will fail
    const { result: determinedCampaignAddress } = await simulateContract(
        viemClient,
        {
            account: session.wallet,
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "deployCampaign",
            args: [
                BigInt(campaign.productId),
                affiliationRangeCampaignId,
                initDataWithOffset,
            ],
        }
    );

    // Return the encoded calldata to deploy and attach this campaign
    const creationData = encodeFunctionData({
        abi: productInteractionManagerAbi,
        functionName: "deployCampaign",
        args: [
            BigInt(campaign.productId),
            affiliationRangeCampaignId,
            initDataWithOffset,
        ],
    });

    const allowRewardData = encodeFunctionData({
        abi: campaignBankAbi,
        functionName: "updateCampaignAuthorisation",
        args: [determinedCampaignAddress, true],
    });

    return {
        tx: [
            {
                to: addresses.productInteractionManager,
                data: creationData as Hex,
            },
            {
                to: campaign.bank,
                data: allowRewardData as Hex,
            },
        ],
    };
}

/**
 * Extract the triggers from a campaign
 * @param campaign
 * @param tokenDecimals
 */
function extractTriggers(campaign: Campaign, tokenDecimals: number) {
    // Rebuild the triggers
    const triggers = Object.entries(campaign.triggers)
        .map(([interactionTypeKey, trigger]) => {
            // The initial reward is just the avg of from and to for now
            const initialReward = Math.floor((trigger.from + trigger.to) / 2);

            // Find the matching interaction types (into the sub-keys of interaction types)
            const interactionType = getHexValueForKey(
                interactionTypeKey as InteractionTypesKey
            );
            if (!interactionType) {
                throw new Error(
                    `No interaction type found for the key ${interactionTypeKey}`
                );
            }

            // Parse the amount
            const { start, end, beta } = computeRangeTriggerReward(trigger);

            return {
                interactionType: interactionType,
                baseReward: parseUnits(initialReward.toString(), tokenDecimals),
                maxCountPerUser: trigger.maxCountPerUser
                    ? BigInt(trigger.maxCountPerUser)
                    : 1n, // Max 1 per user
                startReward: parseUnits(start.toString(), tokenDecimals),
                endReward: parseUnits(end.toString(), tokenDecimals),
                percentBeta: parseUnits(beta.toString(), 4), // on 1e4
            };
        })
        // Filter out trigger with no rewards
        .filter((trigger) => trigger.baseReward > 0n);

    // Check if we got a purchase related triggers, if yes, add an unsafe ppurchase one with same criteria
    const purchaseTrigger = triggers.find(
        (trigger) =>
            trigger.interactionType === interactionTypes.purchase.completed
    );
    const hasUnsafeCompletedTrigger = triggers.some(
        (trigger) =>
            trigger.interactionType ===
            interactionTypes.purchase.unsafeCompleted
    );
    if (purchaseTrigger && !hasUnsafeCompletedTrigger) {
        triggers.push({
            ...purchaseTrigger,
            interactionType: interactionTypes.purchase.unsafeCompleted,
        });
    }

    return triggers;
}

/**
 * Compute the range trigger reward
 *  -> Will find the right start and end offset + the beta distribution parameter for a fixed alpha
 */
function computeRangeTriggerReward({from: initialFrom, to: initialTo}: {from: number, to: number}) {
    // Apply the Frak 20% commission on the born calculation
    const from = initialFrom * 0.8;
    const to = initialTo * 0.8;

    // Calculate the cac goal (avg of from and to)
    const goal = (from + to) / 2;

    // The start part is 0.7 the min reward
    const start = from * 0.7;
    // The end part is to * 5 if to < 50
    const end = to < 50 ? to * 5 : to * 3;

    // The alpha of the distribution curve is always 2
    const alpha = 2;

    // Find the beta
    const beta = alpha * (end - goal) / (goal - start);

    return {
        start,
        end,
        beta,
    };
}

// todo: Ugly, should be reviewed after
function getHexValueForKey(key: InteractionTypesKey): Hex | undefined {
    for (const category in interactionTypes) {
        const categoryTypped = category as keyof typeof interactionTypes;
        // biome-ignore lint/suspicious/noExplicitAny: Will be refacto
        if ((interactionTypes[categoryTypped] as any)[key]) {
            // biome-ignore lint/suspicious/noExplicitAny: Will be refacto
            return (interactionTypes[categoryTypped] as any)[key];
        }
    }
    return undefined;
}

/**
 * Action used to update the campaign state
 * @param campaignId
 * @param txHash
 */
export async function updateCampaignState({
    campaignId,
    txHash,
}: { campaignId: string; txHash?: Hex }) {
    const id = ObjectId.createFromHexString(campaignId);
    const repository = await getCampaignRepository();

    // If no tx hash, just insert it with creation failed status'
    if (!txHash) {
        await repository.updateState(id, {
            key: "creationFailed",
        });
        return;
    }

    // Otherwise, find the deployed address in the logs of the transaction
    const receipt = await getTransactionReceipt(viemClient, {
        hash: txHash,
    });
    const parsedLogs = parseEventLogs({
        abi: parseAbi(["event CampaignCreated(address campaign)"]),
        eventName: "CampaignCreated",
        logs: receipt.logs,
        strict: true,
    });
    const address = first(parsedLogs)?.args?.campaign;
    if (!address) {
        console.error("No address found in the logs", receipt.logs);
        await repository.updateState(id, {
            key: "creationFailed",
        });
        return;
    }

    // Set the success state
    await repository.updateState(id, {
        key: "created",
        txHash,
        address,
    });
}
