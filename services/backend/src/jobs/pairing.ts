import { db } from "@backend-infrastructure";
import { and, isNull, lt, lte, or } from "drizzle-orm";
import {
    PairingContext,
    pairingSignatureRequestTable,
    pairingTable,
} from "../domain/pairing";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

const PAIRING_UNUSED_THRESHOLD_MS = 10 * 60 * 1_000; // 10 min
const PAIRING_INACTIVE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

/**
 * Sweep stale pairing rows (unused after 10m, inactive after 7d).
 * Runs every 6h — the table is small and rows have low traffic, so a
 * frequent sweep buys nothing.
 */
CronRegistry.register(
    new MutexCron({
        name: "cleanupPairings",
        pattern: "0 0-23/6 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up pairings");

            const creationUnusedThreshold = new Date(
                Date.now() - PAIRING_UNUSED_THRESHOLD_MS
            );
            const lastActiveThreshold = new Date(
                Date.now() - PAIRING_INACTIVE_THRESHOLD_MS
            );

            const pResult = await db
                .delete(pairingTable)
                .where(
                    or(
                        and(
                            isNull(pairingTable.wallet),
                            lt(pairingTable.createdAt, creationUnusedThreshold)
                        ),
                        lt(pairingTable.lastActiveAt, lastActiveThreshold)
                    )
                );
            logger.info(`Deleted ${pResult.length} pairings`);
        },
    })
);

/**
 * Sweep expired signature requests every 5 minutes.
 *
 * For every row past its `expiresAt`, server-emit `signature-reject` to
 * both the origin and target topics so any still-connected client sees the
 * promise rejected promptly, then delete the rows.
 *
 * 5 min is tighter than the 6h pairing sweep on purpose: signature requests
 * have a 10-min TTL, and we don't want users staring at a stuck "Awaiting
 * signature…" UI for hours after expiry.
 */
CronRegistry.register(
    new MutexCron({
        name: "cleanupExpiredSignatureRequests",
        pattern: "*/5 * * * *",
        run: async ({ context: { logger } }) => {
            const now = new Date();
            const lastActiveThreshold = new Date(
                Date.now() - PAIRING_INACTIVE_THRESHOLD_MS
            );

            // 1) Live, unprocessed rows past their TTL → emit `signature-reject`
            //    to both topics (so still-connected clients settle their promises)
            //    and delete via `cancelSignatureRequest`.
            const expired = await db
                .select({
                    pairingId: pairingSignatureRequestTable.pairingId,
                    requestId: pairingSignatureRequestTable.requestId,
                })
                .from(pairingSignatureRequestTable)
                .where(
                    and(
                        isNull(pairingSignatureRequestTable.processedAt),
                        lte(pairingSignatureRequestTable.expiresAt, now)
                    )
                );

            for (const { pairingId, requestId } of expired) {
                await PairingContext.repositories.router.cancelSignatureRequest(
                    pairingId,
                    requestId,
                    { code: "expired" }
                );
            }

            // 2) Already-processed rows older than the retention threshold →
            //    plain GC, no reject emit (the request was completed). Doing this
            //    here ensures the table doesn't grow unbounded; the previous
            //    implementation routed these through `cancelSignatureRequest`
            //    which filters `isNull(processedAt)` and silently skipped them.
            const gcResult = await db
                .delete(pairingSignatureRequestTable)
                .where(
                    lt(
                        pairingSignatureRequestTable.processedAt,
                        lastActiveThreshold
                    )
                );
            const gcCount = gcResult.length ?? 0;

            if (expired.length === 0 && gcCount === 0) return;

            logger.info(
                `Expired ${expired.length} signature requests across ${
                    new Set(expired.map((e) => e.pairingId)).size
                } pairing(s); GC'd ${gcCount} processed rows`
            );
        },
    })
);
