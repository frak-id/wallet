"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { contentInteractionManagerAbi } from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    referralCampaignId,
    referralConfigStruct,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import type { ObjectId } from "mongodb";
import { first } from "radash";
import {
    type Hex,
    encodeAbiParameters,
    encodeFunctionData,
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
    let capPeriod = 0;
    if (campaign.budget.type === "daily") {
        capPeriod = 24 * 60 * 60;
    } else if (campaign.budget.type === "monthly") {
        capPeriod = 30 * 24 * 60 * 60;
    }

    // The start and end period
    let start = 0;
    let end = 0;
    if (campaign.scheduled) {
        start = campaign.scheduled.dateStart.getTime() / 1000;
        end = campaign.scheduled.dateEnd.getTime() / 1000;
    }

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(referralConfigStruct, [
        addresses.paywallToken,
        parseEther(initialReward.toString()), // initial reward
        5_000n, // user reward percent (on 1/10_000 so 50%), todo: should be campaign param
        BigInt(capPeriod),
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
    return { id, creationData };
}

/**
 * Action used to update the campaign state
 * @param campaignId
 * @param txHash
 */
export async function updateCampaignState({
    campaignId,
    txHash,
}: { campaignId: ObjectId; txHash?: Hex }) {
    const repository = await getCampaignRepository();

    // If no tx hash, just insert it with creation failed status
    if (!txHash) {
        await repository.updateState(campaignId, {
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
    }

    // Insert it
    await repository.updateState(campaignId, {
        key: "created",
        txHash,
        address: address ?? "0xdeadbeef",
    });
}
