import { getMongoDb } from "@backend-common";
import { Mutex } from "async-mutex";
import type { Collection } from "mongodb";
import type { Address } from "viem";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

/**
 * Access our authenticator repository
 */
export class AuthenticatorRepository {
    private initMutex = new Mutex();
    private collection: Collection<AuthenticatorDocument> | undefined;

    /**
     * Get the collection
     */
    private async getCollection() {
        if (this.collection) {
            return this.collection;
        }

        return this.initMutex.runExclusive(async () => {
            const db = await getMongoDb({
                urlKey: "MONGODB_NEXUS_URI",
                db: "nexus",
            });
            const collection =
                db.collection<AuthenticatorDocument>("authenticators");
            this.collection = collection;
            return collection;
        });
    }

    /**
     * Get all authenticators for the given user
     * @param credentialId
     */
    public async getByCredentialId(
        credentialId: string
    ): Promise<AuthenticatorDocument | null> {
        const collection = await this.getCollection();
        return collection.findOne({ _id: credentialId });
    }

    /**
     * Create a new authenticator for the given user
     * @param authenticator
     */
    public async createAuthenticator(
        authenticator: AuthenticatorDocument
    ): Promise<void> {
        // Ensure no other credential exist with the same id
        const existing = await this.getByCredentialId(authenticator._id);
        if (existing) {
            throw new Error("Credential already exists");
        }

        const collection = await this.getCollection();
        await collection.insertOne(authenticator);
    }

    /**
     * Update the counter for the given authenticator
     * @param authenticatorId
     * @param counter
     */
    public async updateCounter({
        credentialId,
        counter,
    }: { credentialId: string; counter: number }): Promise<void> {
        const collection = await this.getCollection();
        await collection.updateOne(
            { _id: credentialId },
            { $set: { counter } }
        );
    }

    /**
     * Set the smart wallet address for the given credential
     * @param credentialId
     * @param smartWalletAddress
     */
    public async updateSmartWalletAddress({
        credentialId,
        smartWalletAddress,
    }: {
        credentialId: string;
        smartWalletAddress: Address;
    }): Promise<void> {
        const collection = await this.getCollection();
        await collection.updateOne(
            { _id: credentialId },
            { $set: { smartWalletAddress } }
        );
    }
}
