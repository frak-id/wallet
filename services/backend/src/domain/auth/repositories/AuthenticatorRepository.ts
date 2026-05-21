import { getLibsqlDb } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import { getAddress } from "viem";
import { authenticatorsTable } from "../db/schema";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

/**
 * Credential-only repository for the libSQL `authenticators` table. Binding
 * lookups (credential → wallet, per chain, per env) now live on
 * `WalletBindingRepository` against postgres.
 */
export class AuthenticatorRepository {
    /**
     * Get an authenticator by credential id. The returned `smartWalletAddress`
     * is the legacy denormalised value from the row — kept for back-fill
     * consumption and for register fallbacks. Live wallet resolution must go
     * through `WalletBindingRepository.getActiveBinding` instead.
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
     * Idempotent insert: if a row with the same credential id already exists,
     * returns it instead of throwing. Lets clients safely retry registration
     * after a transient backend failure without producing duplicates or 500s.
     *
     * Writes only the credential row (libSQL). The corresponding postgres
     * wallet binding is seeded by the register route via
     * `WalletBindingRepository.seedInitialBinding` so it lands on the right
     * environment.
     */
    public async createAuthenticator(
        authenticator: AuthenticatorDocument
    ): Promise<{ created: boolean; document: AuthenticatorDocument }> {
        const db = getLibsqlDb();
        const insertedRows = await db
            .insert(authenticatorsTable)
            .values({
                id: authenticator._id,
                smartWalletAddress: authenticator.smartWalletAddress
                    ? getAddress(authenticator.smartWalletAddress)
                    : undefined,
                userAgent: authenticator.userAgent,
                publicKeyX: authenticator.publicKey.x,
                publicKeyY: authenticator.publicKey.y,
                credentialPublicKey: authenticator.credentialPublicKey,
                counter: authenticator.counter,
                credentialDeviceType: authenticator.credentialDeviceType,
                credentialBackedUp: authenticator.credentialBackedUp,
                transports: authenticator.transports,
            })
            .onConflictDoNothing()
            .returning();

        if (insertedRows.length > 0) {
            return { created: true, document: authenticator };
        }

        const existingDoc = await this.getByCredentialId(authenticator._id);
        if (!existingDoc) {
            throw new Error(
                "Authenticator insert reported conflict but row could not be retrieved"
            );
        }
        return { created: false, document: existingDoc };
    }
}
