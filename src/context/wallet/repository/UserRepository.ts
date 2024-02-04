import { DI } from "@/context/common/di";
import { getMongoDb } from "@/context/common/mongoDb";
import type { UserDocument } from "@/context/wallet/dto/UserDocument";
import type { Collection, ObjectId } from "mongodb";

/**
 * Repository used to access the user collection
 */
export class UserRepository {
    constructor(private readonly collection: Collection<UserDocument>) {}

    /**
     * Get a user
     */
    public async get(params: { _id: ObjectId } | { username: string }) {
        return this.collection.findOne(params);
    }

    /**
     * Get the user with the given username, or create it otherwise
     * @param username
     */
    public async getOrCreate(username: string) {
        if (!username) {
            throw new Error("No email provided");
        }
        const user = await this.collection.findOneAndUpdate(
            { username },
            { $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        );
        if (!user) {
            throw new Error("Error during user creation");
        }
        return user;
    }

    /**
     * Check if the username is available
     * @param username
     */
    public async isUsernameAvailable(username: string) {
        const usernameCount = await this.collection.countDocuments({
            username,
        });
        return usernameCount === 0;
    }

    /**
     * Set the challenge for the given user
     * @param userId
     * @param challenge
     */
    public async addChallenge({
        userId,
        challenge,
    }: { userId: ObjectId; challenge?: string }): Promise<void> {
        await this.collection.updateOne(
            { _id: userId },
            {
                $addToSet: { challenges: challenge },
            }
        );
    }

    /**
     * Clear all the challenges of a user
     */
    public async clearChallenges({
        userId,
    }: { userId: ObjectId }): Promise<void> {
        await this.collection.updateOne(
            { _id: userId },
            {
                $unset: { challenges: "" },
            }
        );
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
