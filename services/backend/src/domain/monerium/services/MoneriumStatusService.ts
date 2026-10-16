import { log } from "@backend-infrastructure";
import { type Address, isAddress, isAddressEqual } from "viem";
import { type MoneriumConfig, requireMoneriumConfig } from "../config";
import type { MoneriumConnectionRow } from "../db/schema";
import { describeError, notConnected, rethrowUpstream } from "../errors";
import type {
    MoneriumConnectionPatch,
    MoneriumConnectionRepository,
} from "../repositories/MoneriumConnectionRepository";
import type { MoneriumStatusResponse } from "../schemas";
import type {
    MoneriumApiClient,
    MoneriumProfileSummary,
} from "./MoneriumApiClient";
import type { MoneriumTokenService } from "./MoneriumTokenService";
import { TtlCoalescer } from "./TtlCoalescer";

const STATUS_CACHE_TTL_MS = 60_000;
const FORCED_REFRESH_COALESCE_MS = 5_000;
const SIWE_FAILURE_TTL_MS = 7 * 24 * 60 * 60_000;
export const LINK_PENDING_MAX_AGE_MS = 24 * 60 * 60_000;

type MoneriumRefreshResult = {
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

type LinkPatch = Pick<
    MoneriumConnectionPatch,
    "walletLinkState" | "walletLinkPendingAt"
>;

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

    /** `row` when it already satisfies `ready`, else the row after one upstream refresh; null when it still does not. */
    async recheck(
        wallet: Address,
        row: MoneriumConnectionRow,
        ready: (row: MoneriumConnectionRow) => boolean
    ): Promise<MoneriumConnectionRow | null> {
        if (ready(row)) return row;
        const { after } =
            await this.refreshFromMonerium(wallet).catch(rethrowUpstream);
        return ready(after) ? after : null;
    }

    /** Pulls profile and wallet link from Monerium into the cache. Throws on any failure. */
    async refreshFromMonerium(wallet: Address): Promise<MoneriumRefreshResult> {
        const config = requireMoneriumConfig();
        const before = await this.connections.findByWallet(wallet);
        if (!before) throw notConnected();

        const snapshot = await this.tokens.withAccessToken(
            wallet,
            async (accessToken) => {
                const [context, profiles] = await Promise.all([
                    this.client.getAuthContext(accessToken),
                    this.client.listProfiles(accessToken),
                ]);
                const profile = pickProfile(profiles, context.defaultProfile);
                const link = profile
                    ? await this.resolveLinkPatch(
                          accessToken,
                          profile.id,
                          wallet,
                          before,
                          config
                      )
                    : {};
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
                ...link,
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
     * Only the link fields that change: a pending link is known from our own 202 alone,
     * so leaving them out lets a `linkWallet` written meanwhile win. Pending expires after 24 h.
     */
    private async resolveLinkPatch(
        accessToken: string,
        profileId: string,
        wallet: Address,
        before: MoneriumConnectionRow,
        config: MoneriumConfig
    ): Promise<LinkPatch> {
        const addresses = await this.client.listAddresses(accessToken, {
            profile: profileId,
            chain: config.chain,
        });
        const listed = addresses.some(
            (record) =>
                isAddress(record.address, { strict: false }) &&
                isAddressEqual(record.address, wallet) &&
                record.chains.includes(config.chain)
        );
        if (listed) {
            return before.walletLinkState === "linked"
                ? {}
                : { walletLinkState: "linked", walletLinkPendingAt: null };
        }
        if (before.walletLinkState === "none") return {};
        const pendingAt = before.walletLinkPendingAt ?? before.updatedAt;
        if (
            before.walletLinkState === "pending" &&
            Date.now() - pendingAt.getTime() < LINK_PENDING_MAX_AGE_MS
        ) {
            return {};
        }
        return { walletLinkState: "none", walletLinkPendingAt: null };
    }
}

function isStale(row: MoneriumConnectionRow): boolean {
    return (
        !row.stateCheckedAt ||
        Date.now() - row.stateCheckedAt.getTime() > STATUS_CACHE_TTL_MS
    );
}
