import { db, eventEmitter } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { PurchaseInteractionEncoder } from "@frak-labs/core-sdk/interactions";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
} from "../../domain/interactions";
import { OracleContext } from "../../domain/oracle";

/**
 * Export our complete purchase tracker job
 */
export const purchaseTrackerJob = new Elysia({
    name: "Job.interactions.purchaseTracker",
}).use(
    mutexCron({
        name: "purchaseTracker",
        triggerKeys: ["newTrackedPurchase", "oracleUpdated"],
        pattern: "0 */5 * * * *", // Every 5 minutes
        skipIfLocked: true,
        coolDownInMs: 3_000,
        run: async ({ context: { logger } }) => {
            // Get all the currents tracker (max 50 at the time)
            const trackers = await db
                .select()
                .from(interactionsPurchaseTrackerTable)
                .where(eq(interactionsPurchaseTrackerTable.pushed, false))
                .limit(50);

            // For each tracker, try to get the proof, and if done, push the interactions
            for (const tracker of trackers) {
                const result =
                    await OracleContext.services.proof.getPurchaseProof({
                        token: tracker.token,
                        externalId: tracker.externalPurchaseId,
                    });
                if (result.status !== "success") {
                    logger.debug(
                        { result, tracker },
                        "Proof not available yet for tracker"
                    );
                    continue;
                }
                if (result.purchase.status !== "confirmed") {
                    logger.debug(
                        { result, tracker },
                        "Purchase not completed yet for tracker"
                    );
                    continue;
                }

                // If all good, build the interaction and push it
                const interaction =
                    PurchaseInteractionEncoder.completedPurchase({
                        purchaseId: result.purchase.purchaseId,
                        proof: result.proof,
                    });

                // Insert it and mark this interaction as pushed
                await db
                    .insert(pendingInteractionsTable)
                    .values({
                        wallet: tracker.wallet,
                        productId: result.oracle.productId,
                        typeDenominator: interaction.handlerTypeDenominator,
                        interactionData: interaction.interactionData,
                        status: "pending",
                    })
                    .onConflictDoNothing();
                await db
                    .update(interactionsPurchaseTrackerTable)
                    .set({ pushed: true })
                    .where(eq(interactionsPurchaseTrackerTable.id, tracker.id));

                // Emit the event to launch potential simulation
                eventEmitter.emit("newInteractions");
            }
        },
    })
);
