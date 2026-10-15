import type { Address } from "viem";
import { MoneriumApiError, notConnected, reauthRequired } from "../errors";
import type {
    LockedConnectionWriter,
    MoneriumConnectionRepository,
} from "../repositories/MoneriumConnectionRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import type { MoneriumTokenCipher } from "./MoneriumTokenCipher";

export const ACCESS_TOKEN_GRACE_MS = 60_000;

type RefreshOutcome =
    | { kind: "token"; accessToken: string }
    | { kind: "reauth" };

/** Hands out access tokens, refreshing them under a row lock because refresh tokens rotate. */
export class MoneriumTokenService {
    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly cipher: MoneriumTokenCipher,
        private readonly client: MoneriumApiClient
    ) {}

    /**
     * Throws `HttpError` when there is no usable connection and `MoneriumApiError`
     * when Monerium cannot be reached; callers decide how to surface the latter.
     */
    async getAccessToken(
        wallet: Address,
        options: { rejectedToken?: string } = {}
    ): Promise<string> {
        const row = await this.connections.findByWallet(wallet);
        if (!row) throw notConnected();
        if (row.status === "reauth_required") throw reauthRequired();

        if (!options.rejectedToken) {
            const cached = await this.readFreshToken(row);
            if (cached) return cached;
        }

        const outcome = await this.connections.withLockedConnection(
            wallet,
            async (locked, write): Promise<RefreshOutcome> => {
                if (!locked) throw notConnected();
                if (locked.status === "reauth_required") {
                    return { kind: "reauth" };
                }
                const current = await this.readFreshToken(locked);
                if (current && current !== options.rejectedToken) {
                    return { kind: "token", accessToken: current };
                }
                return this.refresh(locked.refreshTokenEncrypted, write);
            }
        );

        if (outcome.kind === "reauth") throw reauthRequired();
        return outcome.accessToken;
    }

    /** One refresh-and-retry when Monerium answers 401 to a token we believed valid. */
    async withAccessToken<T>(
        wallet: Address,
        call: (accessToken: string) => Promise<T>
    ): Promise<T> {
        const accessToken = await this.getAccessToken(wallet);
        try {
            return await call(accessToken);
        } catch (error) {
            if (!(error instanceof MoneriumApiError) || error.status !== 401) {
                throw error;
            }
            const renewed = await this.getAccessToken(wallet, {
                rejectedToken: accessToken,
            });
            return call(renewed);
        }
    }

    private async readFreshToken(row: {
        accessTokenEncrypted: string | null;
        accessTokenExpiresAt: Date | null;
    }): Promise<string | null> {
        if (!row.accessTokenEncrypted || !row.accessTokenExpiresAt) return null;
        if (
            row.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_GRACE_MS <=
            Date.now()
        ) {
            return null;
        }
        try {
            return await this.cipher.decrypt(row.accessTokenEncrypted);
        } catch {
            return null;
        }
    }

    /** The reauth wipe is returned, not thrown: throwing would roll the wipe back with the transaction. */
    private async refresh(
        refreshTokenEncrypted: string | null,
        write: LockedConnectionWriter
    ): Promise<RefreshOutcome> {
        const wipe = async (): Promise<RefreshOutcome> => {
            await write({
                status: "reauth_required",
                accessTokenEncrypted: null,
                accessTokenExpiresAt: null,
                refreshTokenEncrypted: null,
            });
            return { kind: "reauth" };
        };
        if (!refreshTokenEncrypted) return wipe();

        let refreshToken: string;
        try {
            refreshToken = await this.cipher.decrypt(refreshTokenEncrypted);
        } catch {
            return wipe();
        }

        try {
            const tokens = await this.client.refreshAccessToken(refreshToken);
            await write({
                accessTokenEncrypted: await this.cipher.encrypt(
                    tokens.accessToken
                ),
                accessTokenExpiresAt: new Date(
                    Date.now() + tokens.expiresInSeconds * 1000
                ),
                refreshTokenEncrypted: await this.cipher.encrypt(
                    tokens.refreshToken
                ),
            });
            return { kind: "token", accessToken: tokens.accessToken };
        } catch (error) {
            if (error instanceof MoneriumApiError && !error.isUpstreamFailure) {
                return wipe();
            }
            throw error;
        }
    }
}
