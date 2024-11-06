import { eventsContext, log } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { Patterns } from "@elysiajs/cron";
import { PurchaseInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { PurchaseProofService } from "../../oracle/services/proofService";
import { interactionsContext } from "../context";
import {
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
} from "../db/schema";

const outerPurchaseTracker = new Elysia({ name: "Job.OuterPurchaseTracker" })
    .use(interactionsContext)
    .use(eventsContext)
    .use(PurchaseProofService);

type OuterPurchaseTrackerApp = typeof outerPurchaseTracker;

const innerPurchaseTrackerJob = (app: OuterPurchaseTrackerApp) =>
    app.use(
        mutexCron({
            name: "purchaseTracker",
            triggerKeys: ["newTrackedPurchase", "oracleUpdated"],
            pattern: Patterns.everyMinutes(5),
            skipIfLocked: true,
            coolDownInMs: 3_000,
            protect: true,
            catch: true,
            interval: 60,
            run: async () => {
                // Get stuff from the app and the store
                const { interactionsDb, getPurchaseProof } = app.decorator;
                const { emitter } = app.store;

                // Get all the currents tracker (max 50 at the time)
                const trackers = await interactionsDb
                    .select()
                    .from(interactionsPurchaseTrackerTable)
                    .where(eq(interactionsPurchaseTrackerTable.pushed, false))
                    .limit(50);

                // For each tracker, try to get the proof, and if done, push the interactions
                for (const tracker of trackers) {
                    const result = await getPurchaseProof({
                        token: tracker.token,
                        externalId: tracker.externalPurchaseId,
                    });
                    if (result.status !== "success") {
                        log.debug(
                            { result, tracker },
                            "Proof not available yet for tracker"
                        );
                        continue;
                    }
                    if (result.purchase.status !== "confirmed") {
                        log.debug(
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
                    emitter.emit("newInteractions");
                }
            },
        })
    );

/**
 * Export our complete purchase tracker job
 */
export const purchaseTrackerJob = new Elysia({ name: "Job.PurchaseTracker" })
    .use(outerPurchaseTracker)
    .use(innerPurchaseTrackerJob)
    .as("plugin");
