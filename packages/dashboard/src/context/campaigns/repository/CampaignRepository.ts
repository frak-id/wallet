"use server";

import type {
    CampaignDocument,
    CampaignState,
} from "@/context/campaigns/dto/CampaignDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/nexus-wallet/src/context/common/di";
import type { Collection, ObjectId } from "mongodb";

class CampaignRepository {
    constructor(private readonly collection: Collection<CampaignDocument>) {}

    /**
     * Create a new campaign
     * @param campaign
     */
    public async create(campaign: CampaignDocument) {
        const insertResult = await this.collection.insertOne(campaign);
        if (!insertResult.acknowledged) {
            throw new Error("Failed to insert campaign");
        }
        return insertResult.insertedId;
    }

    /**
     * Create a new campaign
     * @param id
     * @param state
     */
    public async updateState(id: ObjectId, state: CampaignState) {
        await this.collection.updateOne({ _id: id }, { $set: { state } });
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
