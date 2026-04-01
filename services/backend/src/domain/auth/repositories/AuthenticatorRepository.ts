import { getLibsqlDb } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import { authenticatorsTable } from "../db/schema";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

export class AuthenticatorRepository {
    /**
     * Get an authenticator by credential id
     */
    public async getByCredentialId(
        credentialId: string
    ): Promise<AuthenticatorDocument | null> {
        const db = getLibsqlDb();
        const [row] = await db
            .select()
            .from(authenticatorsTable)
            .where(eq(authenticatorsTable.id, credentialId));

        if (!row) return null;

        return {
            _id: row.id,
            smartWalletAddress:
                row.smartWalletAddress as AuthenticatorDocument["smartWalletAddress"],
            userAgent: row.userAgent,
            publicKey: {
                x: row.publicKeyX as AuthenticatorDocument["publicKey"]["x"],
                y: row.publicKeyY as AuthenticatorDocument["publicKey"]["y"],
            },
            credentialPublicKey: row.credentialPublicKey,
            counter: row.counter,
            credentialDeviceType:
                row.credentialDeviceType as AuthenticatorDocument["credentialDeviceType"],
            credentialBackedUp: row.credentialBackedUp,
            transports: row.transports as AuthenticatorDocument["transports"],
        };
    }

    /**
     * Create a new authenticator
     */
    public async createAuthenticator(
        authenticator: AuthenticatorDocument
    ): Promise<void> {
        const existing = await this.getByCredentialId(authenticator._id);
        if (existing) {
            throw new Error("Credential already exists");
        }

        const db = getLibsqlDb();
        await db.insert(authenticatorsTable).values({
            id: authenticator._id,
            smartWalletAddress: authenticator.smartWalletAddress,
            userAgent: authenticator.userAgent,
            publicKeyX: authenticator.publicKey.x,
            publicKeyY: authenticator.publicKey.y,
            credentialPublicKey: authenticator.credentialPublicKey,
            counter: authenticator.counter,
            credentialDeviceType: authenticator.credentialDeviceType,
            credentialBackedUp: authenticator.credentialBackedUp,
            transports: authenticator.transports,
        });
    }
}
