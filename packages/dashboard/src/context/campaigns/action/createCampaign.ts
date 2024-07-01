"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import type {
    CampaignDocument,
    CampaignState,
} from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    referralCampaignId,
    referralConfigStruct,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import type { ObjectId } from "mongodb";
import { encodeAbiParameters, encodeFunctionData, parseEther } from "viem";
import { readContract } from "viem/actions";

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

    // Get the referral tree for this content (and thus ensure interaction contract is deployed)
    const interactionContract = await readContract(frakChainPocClient, {
        abi: contentInteractionManagerAbi,
        address: addresses.contentInteractionManager,
        functionName: "getInteractionContract",
        args: [BigInt(campaign.contentId)],
    });
    const referralTree = await readContract(frakChainPocClient, {
        abi: contentInteractionDiamondAbi,
        address: interactionContract,
        functionName: "getReferralTree",
        args: [],
    });

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
        referralTree,
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
 * @param state
 */
export async function updateCampaignState(
    campaignId: ObjectId,
    state: CampaignState
) {
    // Insert it
    const repository = await getCampaignRepository();
    await repository.updateState(campaignId, state);
}
