"use server";

import type {
    CampaignDocument,
    CampaignState,
} from "@/context/campaigns/dto/CampaignDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/shared/context/utils/di";
import type { Collection, ObjectId } from "mongodb";
import type { Address } from "viem";

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

    /**
     * Find all the deployed campaigns by address
     * @param addresses
     * @param creator
     */
    public async findByAddressesOrCreator({
        addresses,
        creator,
    }: { addresses: Address[]; creator: Address }) {
        return this.collection
            .find({
                $or: [{ "state.address": { $in: addresses } }, { creator }],
            })
            .toArray();
    }

    /**
     * Find a campaign by it's id
     * @param id
     */
    public async getOneById(id: ObjectId) {
        return this.collection.findOne({ _id: id });
    }

    /**
     * Delete a campaign by it's id
     * @param id
     */
    public async delete(id: ObjectId) {
        await this.collection.deleteOne({ _id: id });
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
