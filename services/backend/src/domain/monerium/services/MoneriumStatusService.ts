import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { type MoneriumConfig, requireMoneriumConfig } from "../config";
import type { MoneriumConnectionRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumStatusResponse } from "../schemas";
import type {
    MoneriumApiClient,
    MoneriumProfileSummary,
} from "./MoneriumApiClient";
import type { MoneriumTokenService } from "./MoneriumTokenService";

export const STATUS_CACHE_TTL_MS = 60_000;

export type MoneriumRefreshResult = {
    before: MoneriumConnectionRow;
    after: MoneriumConnectionRow;
    /** True only for the caller that actually moved the cached profile state. */
    profileChanged: boolean;
};

export function isSilentReconnectEligible(
    row: Pick<
        MoneriumConnectionRow,
        "status" | "walletLinkState" | "siweFailedAt"
    >,
    config: Pick<MoneriumConfig, "siweEnabled">
): boolean {
    return (
        row.status === "reauth_required" &&
        row.walletLinkState === "linked" &&
        !row.siweFailedAt &&
        config.siweEnabled
    );
}

export function toStatusResponse(
    row: MoneriumConnectionRow | undefined,
    config: Pick<MoneriumConfig, "environment" | "siweEnabled">
): MoneriumStatusResponse {
    if (!row) {
        return {
            connection: "none",
            profile: null,
            walletLink: "none",
            silentReconnect: false,
            environment: config.environment,
        };
    }
    const { profileId, profileKind, profileState } = row;
    return {
        connection: row.status,
        profile:
            profileId && profileKind && profileState
                ? {
                      id: profileId,
                      kind: profileKind,
                      state: profileState,
                      ...(row.profileReasonCode
                          ? { reasonCode: row.profileReasonCode }
                          : {}),
                  }
                : null,
        walletLink: row.walletLinkState,
        silentReconnect: isSilentReconnectEligible(row, config),
        environment: config.environment,
    };
}

function pickProfile(
    profiles: MoneriumProfileSummary[],
    defaultProfile: string | undefined
): MoneriumProfileSummary | undefined {
    return profiles.find((p) => p.id === defaultProfile) ?? profiles[0];
}

export class MoneriumStatusService {
    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly tokens: MoneriumTokenService,
        private readonly client: MoneriumApiClient
    ) {}

    /** Serves the cache, refreshed from Monerium when forced or older than a minute. */
    async getStatus(
        wallet: Address,
        options: { refresh: boolean }
    ): Promise<MoneriumStatusResponse> {
        const config = requireMoneriumConfig();
        let row = await this.connections.findByWallet(wallet);
        if (row?.status === "connected" && (options.refresh || isStale(row))) {
            try {
                await this.refreshFromMonerium(wallet);
            } catch (error) {
                log.warn(
                    { error: describeError(error) },
                    "[Monerium] status refresh failed, serving the cache"
                );
            }
            row = await this.connections.findByWallet(wallet);
        }
        return toStatusResponse(row, config);
    }

    /** Pulls profile and wallet link from Monerium into the cache. Throws on any failure. */
    async refreshFromMonerium(wallet: Address): Promise<MoneriumRefreshResult> {
        const config = requireMoneriumConfig();
        const before = await this.connections.findByWallet(wallet);
        if (!before) throw new Error("Monerium connection not found");

        const snapshot = await this.tokens.withAccessToken(
            wallet,
            async (accessToken) => {
                const context = await this.client.getAuthContext(accessToken);
                const profile =
                    pickProfile(context.profiles, context.defaultProfile) ??
                    pickProfile(
                        await this.client.listProfiles(accessToken),
                        undefined
                    );
                const walletLinkState = profile
                    ? await this.resolveLinkState(
                          accessToken,
                          profile.id,
                          wallet,
                          before.walletLinkState,
                          config
                      )
                    : before.walletLinkState;
                return { context, profile, walletLinkState };
            }
        );

        const { profile } = snapshot;
        const updated = await this.connections.updateIfProfileState(
            wallet,
            before.profileState,
            {
                moneriumUserId:
                    snapshot.context.userId || before.moneriumUserId,
                profileId: profile?.id ?? null,
                profileKind: profile?.kind ?? null,
                profileState: profile?.state ?? null,
                profileReasonCode: profile?.reasonCode ?? null,
                walletLinkState: snapshot.walletLinkState,
                stateCheckedAt: new Date(),
            }
        );
        if (!updated) {
            const current =
                (await this.connections.findByWallet(wallet)) ?? before;
            return { before, after: current, profileChanged: false };
        }
        return {
            before,
            after: updated,
            profileChanged: before.profileState !== updated.profileState,
        };
    }

    /** Monerium lists a linked address; a pending link is only known from our own 202. */
    private async resolveLinkState(
        accessToken: string,
        profileId: string,
        wallet: Address,
        cached: MoneriumConnectionRow["walletLinkState"],
        config: MoneriumConfig
    ): Promise<MoneriumConnectionRow["walletLinkState"]> {
        const addresses = await this.client.listAddresses(accessToken, {
            profile: profileId,
            chain: config.chain,
        });
        const linked = addresses.some(
            (record) =>
                record.address.toLowerCase() === wallet.toLowerCase() &&
                record.chains.includes(config.chain)
        );
        if (linked) return "linked";
        return cached === "pending" ? "pending" : "none";
    }
}

function isStale(row: MoneriumConnectionRow): boolean {
    return (
        !row.stateCheckedAt ||
        Date.now() - row.stateCheckedAt.getTime() > STATUS_CACHE_TTL_MS
    );
}

export function describeError(error: unknown): string {
    if (error instanceof MoneriumApiError) {
        return `${error.status} ${error.moneriumCode ?? ""} ${error.message}`.trim();
    }
    return error instanceof Error ? error.message : "unknown error";
}
