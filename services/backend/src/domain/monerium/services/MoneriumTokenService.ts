import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import {
    describeError,
    MoneriumApiError,
    notConnected,
    reauthRequired,
    requireConnectedRow,
    upstreamUnavailable,
} from "../errors";
import type {
    LockedConnectionWriter,
    MoneriumConnectionRepository,
} from "../repositories/MoneriumConnectionRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import {
    MoneriumCipherIntegrityError,
    type MoneriumTokenCipher,
} from "./MoneriumTokenCipher";

const ACCESS_TOKEN_GRACE_MS = 60_000;

const DEAD_GRANT = /invalid.?grant|refresh.?token|expired|revoked/i;

/** Only a 400/401 that says the refresh token itself is dead: config errors are 400s too. */
function isDeadGrant(error: MoneriumApiError): boolean {
    if (error.status !== 400 && error.status !== 401) return false;
    return DEAD_GRANT.test(`${error.moneriumCode ?? ""} ${error.message}`);
}

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
        requireConnectedRow(row);

        if (!options.rejectedToken) {
            const cached = await this.readFreshToken(wallet, row);
            if (cached) return cached;
        }

        const outcome = await this.connections.withLockedConnection(
            wallet,
            async (locked, write): Promise<RefreshOutcome> => {
                if (!locked) throw notConnected();
                if (locked.status === "reauth_required") {
                    return { kind: "reauth" };
                }
                const current = await this.readFreshToken(wallet, locked);
                if (current && current !== options.rejectedToken) {
                    return { kind: "token", accessToken: current };
                }
                return this.refresh(
                    wallet,
                    locked.refreshTokenEncrypted,
                    write
                );
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

    private async readFreshToken(
        wallet: Address,
        row: {
            accessTokenEncrypted: string | null;
            accessTokenExpiresAt: Date | null;
        }
    ): Promise<string | null> {
        if (!row.accessTokenEncrypted || !row.accessTokenExpiresAt) return null;
        if (
            row.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_GRACE_MS <=
            Date.now()
        ) {
            return null;
        }
        try {
            return await this.cipher.decrypt(
                row.accessTokenEncrypted,
                wallet,
                "access_token_encrypted"
            );
        } catch {
            return null;
        }
    }

    /**
     * The reauth wipe is returned, not thrown: throwing would roll it back with the
     * transaction. It happens only for a refresh token that is provably dead.
     */
    private async refresh(
        wallet: Address,
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
            refreshToken = await this.cipher.decrypt(
                refreshTokenEncrypted,
                wallet,
                "refresh_token_encrypted"
            );
        } catch (error) {
            if (error instanceof MoneriumCipherIntegrityError) return wipe();
            log.error(
                { error: describeError(error) },
                "[Monerium] token encryption key unavailable, keeping the connection"
            );
            throw error;
        }

        try {
            const tokens = await this.client.refreshAccessToken(refreshToken);
            await write({
                accessTokenEncrypted: await this.cipher.encrypt(
                    tokens.accessToken,
                    wallet,
                    "access_token_encrypted"
                ),
                accessTokenExpiresAt: new Date(
                    Date.now() + tokens.expiresInSeconds * 1000
                ),
                refreshTokenEncrypted: await this.cipher.encrypt(
                    tokens.refreshToken,
                    wallet,
                    "refresh_token_encrypted"
                ),
            });
            return { kind: "token", accessToken: tokens.accessToken };
        } catch (error) {
            if (!(error instanceof MoneriumApiError)) throw error;
            if (isDeadGrant(error)) return wipe();
            log.error(
                { status: error.status, moneriumCode: error.moneriumCode },
                "[Monerium] token refresh failed, keeping the connection"
            );
            if (error.isUpstreamFailure) throw error;
            throw upstreamUnavailable();
        }
    }
}
