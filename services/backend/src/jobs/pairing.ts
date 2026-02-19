import { db } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import { and, isNull, lt, lte, or } from "drizzle-orm";
import { Elysia } from "elysia";
import { pairingSignatureRequestTable, pairingTable } from "../domain/pairing";

// Pairing related jobs
export const pairingJobs = new Elysia({ name: "Job.pairing" }).use(
    mutexCron({
        name: "cleanupPairings",
        pattern: "0 0-23/6 * * *", // Every 6 hours
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up pairings");

            // Cleanup threshold
            const creationUnusedThreshold = new Date(
                Date.now() - 10 * 60 * 1000
            );
            const lastActiveThreshold = new Date(
                Date.now() - 7 * 24 * 60 * 60 * 1000
            );

            // Delete all pairing not paired and created more than 10min ago
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

            const now = new Date();
            const sResult = await db.delete(pairingSignatureRequestTable).where(
                or(
                    // Expired and unprocessed
                    and(
                        isNull(pairingSignatureRequestTable.signature),
                        lte(pairingSignatureRequestTable.expiresAt, now)
                    ),
                    // Processed and older than 7 days
                    lt(
                        pairingSignatureRequestTable.processedAt,
                        lastActiveThreshold
                    )
                )
            );
            logger.info(`Deleted ${sResult.length} signature requests`);
        },
    })
);
