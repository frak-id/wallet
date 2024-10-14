import { getMongoDb } from "@/context/common/mongoDb";
import type { AuthenticatorDocument } from "@/context/wallet/dto/AuthenticatorDocument";
import type { Collection } from "mongodb";
import { memo } from "radash";

/**
 * Repository used to access the authenticator collection
 */
class AuthenticatorRepository {
    constructor(
        private readonly collection: Collection<AuthenticatorDocument>
    ) {}

    /**
     * Get all authenticators for the given user
     * @param credentialId
     */
    public getByCredentialId(
        credentialId: string
    ): Promise<AuthenticatorDocument | null> {
        return this.collection.findOne({ _id: credentialId });
    }
}

export const getAuthenticatorRepository = memo(
    async () => {
        const db = await getMongoDb();
        return new AuthenticatorRepository(
            db.collection<AuthenticatorDocument>("authenticators")
        );
    },
    { key: () => "AuthenticatorRepository" }
);
