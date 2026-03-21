import { db } from "@backend-infrastructure";
import { and, isNull, lt, lte, or } from "drizzle-orm";
import { pairingSignatureRequestTable, pairingTable } from "../domain/pairing";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "cleanupPairings",
        pattern: "0 0-23/6 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up pairings");

            const creationUnusedThreshold = new Date(
                Date.now() - 10 * 60 * 1000
            );
            const lastActiveThreshold = new Date(
                Date.now() - 7 * 24 * 60 * 60 * 1000
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

            const now = new Date();
            const sResult = await db
                .delete(pairingSignatureRequestTable)
                .where(
                    or(
                        and(
                            isNull(pairingSignatureRequestTable.signature),
                            lte(pairingSignatureRequestTable.expiresAt, now)
                        ),
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
