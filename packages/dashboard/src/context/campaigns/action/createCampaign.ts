"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import type { DraftCampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getCapPeriod } from "@/context/campaigns/utils/capPeriods";
import {
    referralCampaignId,
    referralConfigStruct,
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
} from "@frak-labs/nexus-sdk/core";
import { ObjectId } from "mongodb";
import { first } from "radash";
import {
    type Hex,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    isAddress,
    parseAbi,
    parseEther,
    parseEventLogs,
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

            // Create the user percent (number between 0 and 1, should be a bigint between 0 and 10_000 after mapping, with no decimals)
            const userPercent = trigger.userPercent
                ? BigInt(Math.floor(trigger.userPercent * 10_000))
                : 5_000n; // default to 50%

            // Same wise for the deperdition level
            const deperditionPerLevel = trigger.deperditionPerLevel
                ? BigInt(Math.floor(trigger.deperditionPerLevel * 10_000))
                : 8_000n; // default to 80%

            return {
                interactionType: interactionType,
                baseReward: parseEther(initialReward.toString()),
                userPercent: userPercent,
                deperditionPerLevel: deperditionPerLevel,
                maxCountPerUser: trigger.maxCountPerUser
                    ? BigInt(trigger.maxCountPerUser)
                    : 1n, // Max 1 per user
            };
        })
        // Filter out trigger with no rewards
        .filter((trigger) => trigger.baseReward > 0n);

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(referralConfigStruct, [
        stringToBytes32(campaign.title),
        campaign.bank,
        // Triggers
        triggers,
        // Cap config
        {
            period: capPeriod,
            amount: campaign.budget.maxEuroDaily
                ? parseEther(campaign.budget.maxEuroDaily.toString())
                : 0n,
        },
        // Activation period
        { start, end },
    ]);
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
                referralCampaignId,
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
            referralCampaignId,
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
