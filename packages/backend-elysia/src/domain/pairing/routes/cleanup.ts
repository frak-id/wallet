import { and, isNull, lt, or } from "drizzle-orm";
import { mutexCron } from "../../../utils";
import type { PairingContextApp } from "../context";
import { pairingSignatureRequestTable, pairingTable } from "../db/schema";

// Job cleanup up everything
export const cleanupCron = (app: PairingContextApp) =>
    app.use(
        mutexCron({
            name: "cleanupPairings",
            pattern: "0 0-23/6 * * *", // Every 30minutes
            run: async ({ context: { logger } }) => {
                logger.debug("Cleaning up pairings");
                const db = app.decorator.pairing.db;

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
                                lt(
                                    pairingTable.createdAt,
                                    creationUnusedThreshold
                                )
                            ),
                            lt(pairingTable.lastActiveAt, lastActiveThreshold)
                        )
                    );
                logger.info(`Deleted ${pResult.length} pairings`);

                // Delete all the signature request not used and created more than 10min ago
                const sResult = await db
                    .delete(pairingSignatureRequestTable)
                    .where(
                        or(
                            and(
                                isNull(pairingSignatureRequestTable.signature),
                                lt(
                                    pairingSignatureRequestTable.createdAt,
                                    creationUnusedThreshold
                                )
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
