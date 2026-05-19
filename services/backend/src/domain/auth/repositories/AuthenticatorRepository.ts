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
     * Case-insensitive lookup of the latest authenticator created with the
     * given email. Used by the registration precheck so the UI can warn a
     * user before triggering the WebAuthn ceremony, and seed a targeted
     * login (with the matching credential id) when the email is already
     * attached to an existing wallet.
     */
    public async findByEmail(email: string): Promise<{
        authenticatorId: string;
        smartWalletAddress: Address | null;
    } | null> {
        const db = getLibsqlDb();
        const normalized = email.trim().toLowerCase();
        const [row] = await db
            .select({
                id: authenticatorsTable.id,
                smartWalletAddress: authenticatorsTable.smartWalletAddress,
            })
            .from(authenticatorsTable)
            .where(sql`LOWER(${authenticatorsTable.email}) = ${normalized}`)
            .limit(1);
        if (!row) return null;
        return {
            authenticatorId: row.id,
            smartWalletAddress:
                (row.smartWalletAddress as Address | null) ?? null,
        };
    }

    /**
     * Get the email currently attached to a credential id, if any.
     * Returned as-is (preserving the original case captured at registration).
     */
    public async getEmail(credentialId: string): Promise<string | null> {
        const db = getLibsqlDb();
        const [row] = await db
            .select({ email: authenticatorsTable.email })
            .from(authenticatorsTable)
            .where(eq(authenticatorsTable.id, credentialId))
            .limit(1);
        return row?.email ?? null;
    }

    /**
     * Attach an email to an existing authenticator. Used by the post-auth
     * "add my email" flow on a credential that was registered without one.
     *
     * Returns the row count actually updated so callers can distinguish a
     * missing credential from a successful update.
     */
    public async updateEmail({
        credentialId,
        email,
    }: {
        credentialId: string;
        email: string;
    }): Promise<{ updated: boolean }> {
        const db = getLibsqlDb();
        const result = await db
            .update(authenticatorsTable)
            .set({ email })
            .where(eq(authenticatorsTable.id, credentialId))
            .returning({ id: authenticatorsTable.id });
        return { updated: result.length > 0 };
    }
}
