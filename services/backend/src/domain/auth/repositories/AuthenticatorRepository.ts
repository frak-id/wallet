import { getLibsqlDb } from "@backend-infrastructure";
import { eq, sql } from "drizzle-orm";
import type { Address } from "viem";
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
            email: row.email ?? undefined,
        };
    }

    /**
     * Get the most recently registered authenticator for a smart wallet
     * address. A wallet can have multiple authenticators (multi-device); we
     * return any valid one — callers that need a specific credential should
     * use `getByCredentialId` instead.
     */
    public async getBySmartWalletAddress(
        smartWalletAddress: Address
    ): Promise<AuthenticatorDocument | null> {
        const db = getLibsqlDb();
        const [row] = await db
            .select()
            .from(authenticatorsTable)
            .where(
                eq(authenticatorsTable.smartWalletAddress, smartWalletAddress)
            )
            .limit(1);

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
            email: row.email ?? undefined,
        };
    }

    /**
     * Idempotent insert: if a row with the same credential id already exists,
     * returns it instead of throwing. Lets clients safely retry registration
     * after a transient backend failure without producing duplicates or 500s.
     */
    public async createAuthenticator(
        authenticator: AuthenticatorDocument
    ): Promise<{ created: boolean; document: AuthenticatorDocument }> {
        const db = getLibsqlDb();
        const inserted = await db
            .insert(authenticatorsTable)
            .values({
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
                email: authenticator.email,
            })
            .onConflictDoNothing()
            .returning();

        if (inserted.length > 0) {
            return { created: true, document: authenticator };
        }

        const existing = await this.getByCredentialId(authenticator._id);
        if (!existing) {
            throw new Error(
                "Authenticator insert reported conflict but row could not be retrieved"
            );
        }
        return { created: false, document: existing };
    }

    /**
     * Case-insensitive check for whether any authenticator row stores
     * the given email. Used by the registration precheck so the UI can warn
     * a user before triggering the WebAuthn ceremony.
     */
    public async hasEmail(email: string): Promise<boolean> {
        const db = getLibsqlDb();
        const normalized = email.trim().toLowerCase();
        const [row] = await db
            .select({ id: authenticatorsTable.id })
            .from(authenticatorsTable)
            .where(sql`LOWER(${authenticatorsTable.email}) = ${normalized}`)
            .limit(1);
        return !!row;
    }
}
