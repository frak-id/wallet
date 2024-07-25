"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    referralCampaignId,
    referralConfigStruct,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { ObjectId } from "mongodb";
import { first } from "radash";
import {
    type Hex,
    encodeAbiParameters,
    encodeFunctionData,
    maxUint256,
    parseAbi,
    parseEther,
    parseEventLogs,
} from "viem";
import { getTransactionReceipt } from "viem/actions";

/**
 * Function to create a new campaign
 * @param campaign
 */
export async function saveCampaign(campaign: Campaign) {
    const currentSession = await getSafeSession();

    if (!campaign.contentId) {
        throw new Error("Content ID is required");
    }

    const clickRewards = campaign?.rewards?.click;
    if (!clickRewards) {
        throw new Error("Click reward is required");
    }
    if (clickRewards.from > clickRewards.to) {
        throw new Error("Click reward from must be lower than to");
    }
    if (clickRewards.from < 0) {
        throw new Error("Click reward from must be positive");
    }

    /// Build our campaign document
    const campaignDocument: CampaignDocument = {
        ...campaign,
        creator: currentSession.wallet,
        state: {
            key: "draft",
        },
    };

    // Insert it
    const repository = await getCampaignRepository();
    const id = await repository.create(campaignDocument);

    // Compute the initial reward for a referral (avg between min and max)
    const initialReward = Math.floor((clickRewards.from + clickRewards.to) / 2);

    // Compute the cap period
    let capPeriod = 0n;
    if (campaign.budget.type === "daily") {
        capPeriod = BigInt(24 * 60 * 60);
    } else if (campaign.budget.type === "weekly") {
        capPeriod = BigInt(7 * 24 * 60 * 60);
    } else if (campaign.budget.type === "monthly") {
        capPeriod = BigInt(30 * 24 * 60 * 60);
    } else if (campaign.budget.type === "global") {
        capPeriod = maxUint256;
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

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(referralConfigStruct, [
        addresses.mUsdToken,
        parseEther(initialReward.toString()), // initial reward
        5_000n, // user reward percent (on 1/10_000 so 50%), todo: should be campaign param
        capPeriod,
        campaign.budget.maxEuroDaily
            ? parseEther(campaign.budget.maxEuroDaily.toString())
            : 0n,
        start,
        end,
    ]);

    // Return the encoded calldata to deploy and attach this campaign
    const creationData = encodeFunctionData({
        abi: contentInteractionManagerAbi,
        functionName: "deployCampaign",
        args: [
            BigInt(campaign.contentId),
            referralCampaignId,
            campaignInitData,
        ],
    });

    return { id: id.toHexString(), creationData };
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
    const receipt = await getTransactionReceipt(frakChainPocClient, {
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
