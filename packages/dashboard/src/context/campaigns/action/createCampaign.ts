"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    referralCampaignId,
    referralConfigStruct,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { encodeAbiParameters, encodeFunctionData, parseEther } from "viem";
import { readContract } from "viem/actions";

/**
 * Function to create a new campaign
 * @param campaign
 */
export async function saveCampaign(campaign: Campaign) {
    const currentSession = await getSafeSession();

    if (!campaign.rewards.click) {
        throw new Error("Click reward is required");
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
    await repository.create(campaignDocument);

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
    const initialReward = Math.floor(
        (campaign.rewards.click.from + campaign.rewards.click.to) / 2
    );

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

    // TODO: Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(referralConfigStruct, [
        addresses.paywallToken,
        referralTree,
        parseEther(initialReward.toString()), // initial reward
        5_000n, // user reward percent (on 1/10_000 so 50%)
        BigInt(capPeriod),
        campaign.budget.maxEuroDaily
            ? parseEther(campaign.budget.maxEuroDaily.toString())
            : 0n,
        start,
        end,
    ]);

    // Return the encoded calldata to deploy and attach this campaign
    return encodeFunctionData({
        abi: contentInteractionManagerAbi,
        functionName: "deployCampaign",
        args: [
            BigInt(campaign.contentId),
            referralCampaignId,
            campaignInitData,
        ],
    });
}
