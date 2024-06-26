"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { Campaign } from "@/types/Campaign";

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
}
