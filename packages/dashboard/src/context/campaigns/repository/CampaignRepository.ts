"use server";

import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/nexus-wallet/src/context/common/di";
import type { Collection } from "mongodb";

class CampaignRepository {
    constructor(private readonly collection: Collection<CampaignDocument>) {}

    /**
     * Create a new campaign
     * @param campaign
     */
    public async create(campaign: CampaignDocument) {
        await this.collection.insertOne(campaign);
    }
}

export const getCampaignRepository = DI.registerAndExposeGetter({
    id: "CampaignRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new CampaignRepository(
            db.collection<CampaignDocument>("campaigns")
        );
    },
});
