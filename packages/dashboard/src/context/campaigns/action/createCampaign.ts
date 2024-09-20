"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import type { DraftCampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    referralCampaignId,
    referralConfigStruct,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import {
    addresses,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { interactionTypes } from "@frak-labs/nexus-sdk/core";
import { ObjectId } from "mongodb";
import { first } from "radash";
import {
    type Address,
    type Hex,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    parseAbi,
    parseEther,
    parseEventLogs,
    stringToHex,
} from "viem";
import { getTransactionReceipt, simulateContract } from "viem/actions";

const productIdToBanks = [
    {
        pid: 33953649417576654953995537313820306697747390492794311279756157547821320957282n,
        bank: "0xd0d3E757626d221f2Fd1ddA62da46CcA67622C99" as Address,
    },
    {
        pid: 20376791661718660580662410765070640284736320707848823176694931891585259913409n,
        bank: "0xdc473FB7f56004bBD6AD019090e9BdD57e885242" as Address,
    },
];

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

    // const clickRewards = campaign?.rewards?.click;
    // if (!clickRewards) {
    //     throw new Error("Click reward is required");
    // }
    // if (clickRewards.from > clickRewards.to) {
    //     throw new Error("Click reward from must be lower than to");
    // }
    // if (clickRewards.from < 0) {
    //     throw new Error("Click reward from must be positive");
    // }

    // Compute the initial reward for a referral (avg between min and max)
    // const initialReward = Math.floor((clickRewards.from + clickRewards.to) / 2);
    const initialReward = 0;

    // Compute the cap period
    let capPeriod = 0;
    if (campaign.budget.type === "daily") {
        capPeriod = 24 * 60 * 60;
    } else if (campaign.budget.type === "weekly") {
        capPeriod = 7 * 24 * 60 * 60;
    } else if (campaign.budget.type === "monthly") {
        capPeriod = 30 * 24 * 60 * 60;
    } else if (campaign.budget.type === "global") {
        // Max uint48
        capPeriod = 281474976710655;
    }

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

    // The blockchain name of the campaign is fitted on a bytes32
    const blockchainName = stringToHex(
        campaign.title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 32),
        {
            size: 32,
        }
    );

    // todo: bank from frontend config
    const bank = productIdToBanks.find(
        (b) => b.pid === BigInt(campaign.productId)
    )?.bank;
    if (!bank) {
        throw new Error("No bank found for the given product id");
    }

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(referralConfigStruct, [
        blockchainName,
        bank,
        // Triggers (todo: from frontend)
        [
            {
                interactionType: interactionTypes.referral.referred,
                baseReward: parseEther(initialReward.toString()),
                userPercent: 5_000n, // user reward percent (on 1/10_000 so 50%), todo: should be campaign param
                deperditionPerLevel: 8_000n, // 80% deperdition per level
                maxCountPerUser: 1n, // Max 1 trigger per user
            },
        ],
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
                to: bank,
                data: allowRewardData as Hex,
            },
        ],
    };
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
