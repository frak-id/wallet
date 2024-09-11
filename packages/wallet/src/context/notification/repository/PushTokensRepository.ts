import { getMongoDb } from "@/context/common/mongoDb";
import type { PushTokenDocument } from "@/context/notification/dto/PushTokenDocument";
import type { Collection, DeleteResult } from "mongodb";
import { memo } from "radash";
import type { Address, Hex } from "viem";

/**
 * Repository used to access the authenticator collection
 */
class PushTokensRepository {
    constructor(private readonly collection: Collection<PushTokenDocument>) {}

    /**
     * Check if a push token already exists for the given id
     * @param id
     */
    public async existForId(id: Hex): Promise<boolean> {
        return (await this.collection.findOne({ _id: id })) !== null;
    }

    /**
     * Create a new push token
     * @param token
     */
    public async create(token: PushTokenDocument): Promise<void> {
        await this.collection.insertOne(token);
    }

    /**
     * Get all the push token for the given wallets
     * @param wallets
     */
    public getForWallets(wallets: Address[]): Promise<PushTokenDocument[]> {
        const addressesRegex = new RegExp(wallets.join("|"), "i");
        return this.collection
            .find({ wallet: { $regex: addressesRegex } })
            .toArray();
    }

    /**
     * Get all the push token for a given wallet
     * @param wallet
     */
    public removeAllForWallet(wallet: Address): Promise<DeleteResult> {
        return this.collection.deleteMany({
            wallet: { $regex: new RegExp(`^${wallet}$`, "i") },
        });
    }

    /**
     * Cleanup all the expired tokens
     */
    public async cleanExpiredTokens(): Promise<void> {
        // Remove all the tokens where expiration is passed
        await this.collection.deleteMany({
            expirationTimestamp: { $lt: Date.now() },
        });
    }
}

export const getPushTokensRepository = memo(
    async () => {
        const db = await getMongoDb();
        return new PushTokensRepository(
            db.collection<PushTokenDocument>("pushTokens")
        );
    },
    { key: () => "PushTokensRepository" }
);
