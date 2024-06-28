"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { Campaign } from "@/types/Campaign";
import { encodeAbiParameters } from "viem";

/**
 * The abi struct used for the referral campaign config
 */
const referralConfigStruct = [
    { name: "token", internalType: "address", type: "address" },
    { name: "referralTree", internalType: "bytes32", type: "bytes32" },
    { name: "initialReward", internalType: "uint256", type: "uint256" },
    {
        name: "userRewardPercent",
        internalType: "uint256",
        type: "uint256",
    },
    {
        name: "distributionCapPeriod",
        internalType: "uint256",
        type: "uint256",
    },
    { name: "distributionCap", internalType: "uint256", type: "uint256" },
    { name: "startDate", internalType: "uint48", type: "uint48" },
    { name: "endDate", internalType: "uint48", type: "uint48" },
] as const;

/**
 * Function to create a new campaign
 * @param campaign
 */
export async function saveCampaign(campaign: Campaign) {
    const currentSession = await getSafeSession();

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

    // TODO: Build the tx to be sent by the creator to create the given campaign
    // const deployData = encodeAbiParameters(referralConfigStruct, []);
}
