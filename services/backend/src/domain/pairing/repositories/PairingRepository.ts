import { db, log } from "@backend-infrastructure";
import { inArray } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import { pairingTable } from "../db/schema";
import type { WsDirectMessageResponse } from "../dto/WebsocketDirectMessage";
import type { WsTopicMessage } from "../dto/WebsocketTopicMessage";

const FLUSH_INTERVAL_MS = 60_000;
const MIN_UPDATE_INTERVAL_MS = 60_000;

/**
 * Batches lastActiveAt writes in-memory and flushes to DB once per
 * minute, instead of issuing an UPDATE on every WebSocket message.
 * Throttles per-pairingId so the same pairing is updated at most once
 * per MIN_UPDATE_INTERVAL_MS.
 */
class LastActiveTracker {
    private readonly pending = new Map<string, number>();
    private readonly lastFlushed = new Map<string, number>();

    constructor() {
        setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

        // Flush pending writes on graceful shutdown
        const onShutdown = () => {
            this.flush();
        };
        process.on("SIGTERM", onShutdown);
        process.on("SIGINT", onShutdown);
    }

    touch(pairingId: string) {
        const now = Date.now();
        const lastFlush = this.lastFlushed.get(pairingId) ?? 0;

        if (now - lastFlush < MIN_UPDATE_INTERVAL_MS) {
            return;
        }

        this.pending.set(pairingId, now);
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

            const now = Date.now();
            for (const id of pairingIds) {
                this.lastFlushed.set(id, now);
            }
        } catch (err) {
            log.error(
                { err, count: pairingIds.length },
                "Failed to flush lastActiveAt batch"
            );
        }
    }
}

const lastActiveTracker = new LastActiveTracker();

export abstract class PairingRepository {
    protected sendDirectMessage({
        ws,
        message,
    }: {
        ws: ElysiaWS;
        message: WsDirectMessageResponse | WsTopicMessage;
    }) {
        ws.send(message);
    }

    protected sendTopicMessage({
        ws,
        pairingId,
        message,
        topic,
        skipUpdate = false,
    }: {
        ws: ElysiaWS;
        pairingId: string;
        message: WsTopicMessage;
        topic: "origin" | "target";
        skipUpdate?: boolean;
    }) {
        if (!skipUpdate) {
            lastActiveTracker.touch(pairingId);
        }
        log.debug(
            {
                type: message.type,
                formattedTopic:
                    topic === "origin"
                        ? originTopic(pairingId)
                        : targetTopic(pairingId),
            },
            "Sending topic message"
        );
        ws.publish(
            topic === "origin"
                ? originTopic(pairingId)
                : targetTopic(pairingId),
            message
        );
    }
}

export function originTopic(pairingId: string) {
    return `pairing:${pairingId}:origin`;
}

export function targetTopic(pairingId: string) {
    return `pairing:${pairingId}:target`;
}
