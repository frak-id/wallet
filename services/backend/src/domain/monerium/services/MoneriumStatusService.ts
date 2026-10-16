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
import { TtlCoalescer } from "./TtlCoalescer";

export const STATUS_CACHE_TTL_MS = 60_000;
export const FORCED_REFRESH_COALESCE_MS = 5_000;
export const SIWE_FAILURE_TTL_MS = 7 * 24 * 60 * 60_000;
export const LINK_PENDING_MAX_AGE_MS = 24 * 60 * 60_000;

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
    >
): boolean {
    return (
        row.status === "reauth_required" &&
        row.walletLinkState === "linked" &&
        !isRecentSiweFailure(row.siweFailedAt)
    );
}

function isRecentSiweFailure(failedAt: Date | null): boolean {
    return (
        failedAt !== null &&
        Date.now() - failedAt.getTime() < SIWE_FAILURE_TTL_MS
    );
}

export function toStatusResponse(
    row: MoneriumConnectionRow | undefined,
    config: Pick<MoneriumConfig, "environment">
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
        silentReconnect: isSilentReconnectEligible(row),
        environment: config.environment,
    };
}

function pickProfile(
    profiles: MoneriumProfileSummary[],
    defaultProfile: string | undefined
): MoneriumProfileSummary | undefined {
    return profiles.find((p) => p.id === defaultProfile) ?? profiles[0];
}

type LinkResolution = {
    state: MoneriumConnectionRow["walletLinkState"];
    pendingAt: Date | null;
};

export class MoneriumStatusService {
    private readonly forcedRefreshes = new TtlCoalescer<MoneriumRefreshResult>(
        FORCED_REFRESH_COALESCE_MS
    );

    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly tokens: MoneriumTokenService,
        private readonly client: MoneriumApiClient
    ) {}

    /** Serves the cache, refreshed from Monerium when forced or older than a minute. A wallet forces at most one upstream refresh per 5 s. */
    async getStatus(
        wallet: Address,
        options: { refresh: boolean }
    ): Promise<MoneriumStatusResponse> {
        const config = requireMoneriumConfig();
        let row = await this.connections.findByWallet(wallet);
        if (row?.status === "connected" && (options.refresh || isStale(row))) {
            try {
                await (options.refresh
                    ? this.forcedRefreshes.run(wallet.toLowerCase(), () =>
                          this.refreshFromMonerium(wallet)
                      )
                    : this.refreshFromMonerium(wallet));
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
                const [context, profiles] = await Promise.all([
                    this.client.getAuthContext(accessToken),
                    this.client.listProfiles(accessToken),
                ]);
                const profile = pickProfile(profiles, context.defaultProfile);
                const link: LinkResolution = profile
                    ? await this.resolveLinkState(
                          accessToken,
                          profile.id,
                          wallet,
                          before,
                          config
                      )
                    : {
                          state: before.walletLinkState,
                          pendingAt: before.walletLinkPendingAt,
                      };
                return { context, profile, link };
            }
        );

        const { profile, link } = snapshot;
        const nextProfileState = profile?.state ?? null;
        const updated = await this.connections.updateIfProfileState(
            wallet,
            before.profileState,
            {
                moneriumUserId:
                    snapshot.context.userId || before.moneriumUserId,
                profileId: profile?.id ?? null,
                profileKind: profile?.kind ?? null,
                profileState: nextProfileState,
                profileReasonCode: profile?.reasonCode ?? null,
                ...(nextProfileState !== before.profileState
                    ? { profileStateChangedAt: new Date() }
                    : {}),
                walletLinkState: link.state,
                walletLinkPendingAt: link.pendingAt,
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

    /**
     * Monerium lists a linked address; a pending link is only known from our own 202,
     * so it is read fresh (a link may have just been written) and kept for 24 h.
     */
    private async resolveLinkState(
        accessToken: string,
        profileId: string,
        wallet: Address,
        before: MoneriumConnectionRow,
        config: MoneriumConfig
    ): Promise<LinkResolution> {
        const addresses = await this.client.listAddresses(accessToken, {
            profile: profileId,
            chain: config.chain,
        });
        const linked = addresses.some(
            (record) =>
                record.address.toLowerCase() === wallet.toLowerCase() &&
                record.chains.includes(config.chain)
        );
        if (linked) return { state: "linked", pendingAt: null };

        const current = (await this.connections.findByWallet(wallet)) ?? before;
        const pendingAt = current.walletLinkPendingAt ?? current.updatedAt;
        if (
            current.walletLinkState === "pending" &&
            Date.now() - pendingAt.getTime() < LINK_PENDING_MAX_AGE_MS
        ) {
            return { state: "pending", pendingAt };
        }
        return { state: "none", pendingAt: null };
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
        return `${error.status} ${error.moneriumCode ?? ""}`.trim();
    }
    return error instanceof Error ? error.message : "unknown error";
}
