import type { Collection, Db } from "mongodb";
import type { Address } from "viem";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

/**
 * Access our authenticator repository
 */
export class AuthenticatorRepository {
    private readonly collection: Collection<AuthenticatorDocument>;
    constructor(db: Db) {
        this.collection =
            db.collection<AuthenticatorDocument>("authenticators");
    }

    /**
     * Get all authenticators for the given user
     * @param credentialId
     */
    public getByCredentialId(
        credentialId: string
    ): Promise<AuthenticatorDocument | null> {
        return this.collection.findOne({ _id: credentialId });
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

        await this.collection.insertOne(authenticator);
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
        await this.collection.updateOne(
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
        await this.collection.updateOne(
            { _id: credentialId },
            { $set: { smartWalletAddress } }
        );
    }
}
