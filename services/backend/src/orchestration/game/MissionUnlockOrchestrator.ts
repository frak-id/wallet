import { log, productEvents } from "@backend-infrastructure";
import {
    and,
    eq,
    exists,
    gt,
    inArray,
    isNotNull,
    isNull,
    ne,
    not,
    or,
    type SQL,
    sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
    DEFAULT_MISSIONS,
    type Mission,
    type MissionSet,
    REFEREE_WAITING_ROLES,
    RELEASE_GRACE_MS,
} from "../../domain/game";
import { instagramLinksTable } from "../../domain/instagram/db/schema";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import { LIVE_ASSET_STATUSES } from "../../domain/rewards/schemas";
import { db } from "../../infrastructure/persistence/postgres";

const missionReward = alias(assetLogsTable, "mission_reward");

// Literal statuses, so the planner proves the `asset_logs_held_idx` predicate.
const heldPayable = sql`${assetLogsTable.heldAt} IS NOT NULL AND ${assetLogsTable.status} IN ('pending', 'bank_depleted')`;

const subjectId = sql`CASE WHEN ${inArray(assetLogsTable.recipientType, [...REFEREE_WAITING_ROLES])} THEN ${interactionLogsTable.identityGroupId} ELSE ${assetLogsTable.identityGroupId} END`;

/** The subject's partner-brand rewards, correlated to the held row. */
const brandRewardsOfSubject = and(
    eq(missionReward.identityGroupId, subjectId),
    ne(missionReward.merchantId, FRAK_MERCHANT_ID),
    isNull(missionReward.heldAt),
    inArray(missionReward.status, [...LIVE_ASSET_STATUSES])
);

function subjectInstagramLink(...filters: SQL[]) {
    return exists(
        db
            .select({ one: sql`1` })
            .from(instagramLinksTable)
            .where(
                and(
                    eq(instagramLinksTable.identityGroupId, subjectId),
                    ...filters
                )
            )
    );
}

function missionMet(mission: Mission): SQL {
    switch (mission.kind) {
        case "brand_reward":
            return exists(
                db
                    .select({ one: sql`1` })
                    .from(missionReward)
                    .where(brandRewardsOfSubject)
            );
        case "instagram_follow":
            return subjectInstagramLink(eq(instagramLinksTable.follows, true));
    }
}

/** An unfollow keeps the link row, so a release earned by a follow is never taken back; only a brand refund is. */
function missionKept(mission: Mission): SQL {
    return mission.kind === "instagram_follow"
        ? subjectInstagramLink()
        : missionMet(mission);
}

/** NULL when unmet, `-infinity` when met with no lockup to wait for. */
function missionReadyAt(mission: Mission): SQL {
    switch (mission.kind) {
        case "brand_reward": {
            const earliest = db
                .select({
                    at: sql`MIN(COALESCE(${missionReward.availableAt}, '-infinity'::timestamp))`,
                })
                .from(missionReward)
                .where(brandRewardsOfSubject);
            return sql`(${earliest})`;
        }
        case "instagram_follow":
            return sql`CASE WHEN ${missionMet(mission)} THEN '-infinity'::timestamp END`;
    }
}

function combine(set: MissionSet, check: (mission: Mission) => SQL): SQL {
    const checks = set.missions.map(check);
    return (set.match === "all" ? and(...checks) : or(...checks)) ?? sql`false`;
}

const setMet = (set: MissionSet) => combine(set, missionMet);
const setKept = (set: MissionSet) => combine(set, missionKept);

/** The released reward waits for its mission rewards' own lockup to end. */
function setReadyAt(set: MissionSet): SQL {
    const readyAt = sql.join(set.missions.map(missionReadyAt), sql`, `);
    const combined =
        set.match === "all"
            ? sql`GREATEST(${readyAt})`
            : sql`LEAST(${readyAt})`;
    return sql`NULLIF(${combined}, '-infinity'::timestamp)`;
}

/**
 * Releases held game rewards once their missions are met and holds them again
 * when the missions disappear (a brand refund). Run before settlement and expiry.
 */
export class MissionUnlockOrchestrator {
    constructor(private readonly assetLogRepository: AssetLogRepository) {}

    async run(): Promise<{ released: number; reheld: number }> {
        const now = new Date();
        const [toRelease, toRehold] = await Promise.all([
            this.findMet(now, DEFAULT_MISSIONS),
            this.findLapsed(DEFAULT_MISSIONS),
        ]);
        const releasedIds = new Set(
            await this.assetLogRepository.releaseHeld(
                toRelease,
                RELEASE_GRACE_MS
            )
        );
        for (const row of toRelease) {
            if (!releasedIds.has(row.id)) continue;
            productEvents.track("game_reward_unlocked", row.identityGroupId, {
                recipient_type: row.recipientType,
            });
        }
        const released = releasedIds.size;
        const reheld = await this.assetLogRepository.reholdReleased(
            toRehold.map((row) => row.id)
        );
        if (released > 0 || reheld > 0) {
            log.info({ released, reheld }, "Applied game mission releases");
        }
        return { released, reheld };
    }

    private findMet(now: Date, missions: MissionSet) {
        return db
            .select({
                id: assetLogsTable.id,
                identityGroupId: assetLogsTable.identityGroupId,
                recipientType: assetLogsTable.recipientType,
                availableAt: sql<Date | null>`${setReadyAt(missions)}`.mapWith(
                    assetLogsTable.availableAt
                ),
            })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(interactionLogsTable.id, assetLogsTable.interactionLogId)
            )
            .where(
                and(
                    heldPayable,
                    isNull(assetLogsTable.releasedAt),
                    gt(assetLogsTable.expiresAt, now),
                    setMet(missions)
                )
            );
    }

    private findLapsed(missions: MissionSet) {
        return db
            .select({ id: assetLogsTable.id })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(interactionLogsTable.id, assetLogsTable.interactionLogId)
            )
            .where(
                and(
                    heldPayable,
                    isNotNull(assetLogsTable.releasedAt),
                    not(setKept(missions))
                )
            );
    }
}
