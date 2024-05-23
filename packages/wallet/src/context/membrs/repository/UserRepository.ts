import { DI } from "@/context/common/di";
import { getMongoDb } from "@/context/common/mongoDb";
import type { UserDocument } from "@/context/membrs/dto/UserDocument";
import type { Collection } from "mongodb";
import type { Hex } from "viem";

/**
 * Repository used to access the user collection
 */
export class UserRepository {
    constructor(private readonly collection: Collection<UserDocument>) {}

    /**
     * Get a user by its id
     * @param id
     */
    public async getById(id: Hex): Promise<UserDocument | null> {
        return this.collection.findOne({ _id: id });
    }

    /**
     * Create or update a user
     */
    public async createOrUpdate({ _id, username, photo }: UserDocument) {
        const result = await this.collection.updateOne(
            { _id },
            { $set: { username, photo } },
            { upsert: true }
        );
        if (!result.acknowledged) {
            throw new Error("Unable to save the user in the database");
        }
    }
}

export const getUserRepository = DI.registerAndExposeGetter({
    id: "UserRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new UserRepository(db.collection<UserDocument>("users"));
    },
});
