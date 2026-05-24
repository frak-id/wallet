import { db, log } from "@backend-infrastructure";
import { eq, inArray } from "drizzle-orm";
import type { Hex } from "viem";
import type { IdentityNode } from "../../../orchestration/identity/types";
import { pairingTable } from "../db/schema";

const FLUSH_INTERVAL_MS = 60_000;

/**
 * Batches lastActiveAt writes in-memory and flushes to DB once per
 * minute, instead of issuing an UPDATE on every WebSocket message.
 * The pending Map naturally deduplicates — each pairingId appears at
 * most once per flush cycle.
 */
class LastActiveTracker {
    private readonly pending = new Map<string, number>();

    constructor() {
        setInterval(() => this.flush(), FLUSH_INTERVAL_MS).unref();

        const onShutdown = () => {
            this.flush();
        };
        process.on("SIGTERM", onShutdown);
        process.on("SIGINT", onShutdown);
    }

    touch(pairingId: string) {
        this.pending.set(pairingId, Date.now());
    }

    private async flush() {
        if (this.pending.size === 0) return;

        const pairingIds = Array.from(this.pending.keys());
        this.pending.clear();

        try {
            await db
                .update(pairingTable)
                .set({ lastActiveAt: new Date() })
                .where(inArray(pairingTable.pairingId, pairingIds));
        } catch (err) {
            log.error(
                { err, count: pairingIds.length },
                "Failed to flush lastActiveAt batch"
            );
        }
    }
}

export type PairingRow = typeof pairingTable.$inferSelect;

export class PairingRepository {
    private readonly lastActiveTracker = new LastActiveTracker();

    async create(params: {
        pairingId: string;
        pairingCode: string;
        originUserAgent: string;
        originName: string;
        originNode: IdentityNode | undefined;
        authenticatorHint: string | null;
    }): Promise<void> {
        await db.insert(pairingTable).values({
            pairingId: params.pairingId,
            pairingCode: params.pairingCode,
            originUserAgent: params.originUserAgent,
            originName: params.originName,
            originNode: params.originNode,
            authenticatorHint: params.authenticatorHint,
        });
    }

    async getByPairingId(pairingId: string): Promise<PairingRow | undefined> {
        return db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, pairingId),
        });
    }

    async getByWallet(
        wallet: Hex
    ): Promise<{ pairingId: string; originName: string }[]> {
        return db
            .select({
                pairingId: pairingTable.pairingId,
                originName: pairingTable.originName,
            })
            .from(pairingTable)
            .where(eq(pairingTable.wallet, wallet));
    }

    /**
     * Mark a pairing resolved at target join. `authenticatorId` is
     * captured here so resume can replay the `authenticated` payload
     * using the exact credential the target joined with — no later
     * `wallet -> binding` lookup needed.
     */
    async markResolved(params: {
        pairingId: string;
        wallet: Hex;
        authenticatorId: string;
        targetUserAgent: string;
        targetName: string;
    }): Promise<void> {
        const now = new Date();
        await db
            .update(pairingTable)
            .set({
                wallet: params.wallet,
                authenticatorId: params.authenticatorId,
                targetUserAgent: params.targetUserAgent,
                targetName: params.targetName,
                resolvedAt: now,
                lastActiveAt: now,
            })
            .where(eq(pairingTable.pairingId, params.pairingId));
    }

    /**
     * Sync UPDATE of lastActiveAt — used by the resume flow where we
     * want the cleanup cron to see the row as alive before any further
     * topic traffic happens.
     */
    async touchLastActiveNow(pairingId: string): Promise<void> {
        await db
            .update(pairingTable)
            .set({ lastActiveAt: new Date() })
            .where(eq(pairingTable.pairingId, pairingId));
    }

    /**
     * Queue a lastActiveAt touch for the next batched flush (default
     * every 60s). Cheap, dedup'd per pairingId. Used on every topic
     * message — the batched flush keeps writes off the hot path.
     */
    touchLastActiveBatched(pairingId: string): void {
        this.lastActiveTracker.touch(pairingId);
    }
}
