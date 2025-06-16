import { eventEmitter } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { PurchaseInteractionEncoder } from "@frak-labs/core-sdk/interactions";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    interactionsContext,
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
} from "../../domain/interactions";
import { oracleContext } from "../../domain/oracle";

const innerPurchaseTrackerJob = (
    app: typeof interactionsContext & typeof oracleContext
) =>
    app.use(
        mutexCron({
            name: "purchaseTracker",
            triggerKeys: ["newTrackedPurchase", "oracleUpdated"],
            pattern: "0 */5 * * * *", // Every 5 minutes
            skipIfLocked: true,
            coolDownInMs: 3_000,
            run: async ({ context: { logger } }) => {
                const {
                    interactions: { db: interactionsDb },
                    oracle: {
                        services: { proof },
                    },
                } = app.decorator;
                // Get all the currents tracker (max 50 at the time)
                const trackers = await interactionsDb
                    .select()
                    .from(interactionsPurchaseTrackerTable)
                    .where(eq(interactionsPurchaseTrackerTable.pushed, false))
                    .limit(50);

                // For each tracker, try to get the proof, and if done, push the interactions
                for (const tracker of trackers) {
                    const result = await proof.getPurchaseProof({
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
                    await interactionsDb
                        .insert(pendingInteractionsTable)
                        .values({
                            wallet: tracker.wallet,
                            productId: result.oracle.productId,
                            typeDenominator: interaction.handlerTypeDenominator,
                            interactionData: interaction.interactionData,
                            status: "pending",
                        })
                        .onConflictDoNothing();
                    await interactionsDb
                        .update(interactionsPurchaseTrackerTable)
                        .set({ pushed: true })
                        .where(
                            eq(interactionsPurchaseTrackerTable.id, tracker.id)
                        );

                    // Emit the event to launch potential simulation
                    eventEmitter.emit("newInteractions");
                }
            },
        })
    );

/**
 * Export our complete purchase tracker job
 */
export const purchaseTrackerJob = new Elysia({
    name: "Jobs.interactions.purchaseTracker",
})
    .use(interactionsContext)
    .use(oracleContext)
    .use(innerPurchaseTrackerJob);
