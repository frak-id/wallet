"use server";

import type {
    CampaignDocument,
    CampaignState,
    DraftCampaignDocument,
} from "@/context/campaigns/dto/CampaignDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/shared/context/utils/di";
import { type Collection, ObjectId } from "mongodb";
import type { Address } from "viem";

class CampaignRepository {
    constructor(private readonly collection: Collection<CampaignDocument>) {}

    /**
     * Normalize the id
     * @param id
     * @private
     */
    private normalizeId(id: string | ObjectId) {
        return typeof id === "string" ? ObjectId.createFromHexString(id) : id;
    }

    /**
     * Upsert a campaign draft
     */
    public async upsertDraft(draft: DraftCampaignDocument) {
        // If no id, just insert it
        if (!draft._id) {
            const insertResult = await this.collection.insertOne(draft);
            if (!insertResult.acknowledged) {
                throw new Error("Failed to insert campaign");
            }

            // And return the draft just after
            return {
                ...draft,
                _id: insertResult.insertedId,
            };
        }

        // Otherwise, parse the id (if string, to object id, otherwise, just the id)
        const id = this.normalizeId(draft._id);
        const draftWithNormalizedId = { ...draft, _id: id };
        return this.collection.findOneAndReplace(
            {
                _id: id,
            },
            draftWithNormalizedId,
            {
                returnDocument: "after",
            }
        );
    }

    /**
     * Create a new campaign
     * @param id
     * @param state
     */
    public async updateState(
        id: ObjectId,
        state: Extract<CampaignState, { key: "created" | "creationFailed" }>
    ) {
        await this.collection.updateOne(
            { _id: this.normalizeId(id) },
            { $set: { state } }
        );
    }

    /**
     * Find all the deployed campaigns by address
     * @param addresses
     * @param creator
     */
    public async findByAddressesOrCreator({
        addresses,
        creator,
    }: { addresses: Address[]; creator?: Address }) {
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
        return this.collection.findOne({ _id: this.normalizeId(id) });
    }

    /**
     * Delete a campaign by it's id
     * @param id
     */
    public async delete(id: ObjectId) {
        await this.collection.deleteOne({ _id: this.normalizeId(id) });
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
