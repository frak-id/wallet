import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isAddressEqual } from "viem";
import { pendingInteractionsTable } from "../../db/schema";
import { interactionsContext } from "../context";
import type { SimulateInteractionAppJob } from "../jobs/simulate";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/push",
        async ({ body, session, error, interactionsDb, store }) => {
            if (!session) return;

            // Ensure the address matches
            if (!isAddressEqual(session.wallet.address, body.wallet)) {
                return error(403, "Invalid wallet address");
            }

            // Insert it in the pending state
            interactionsDb.insert(pendingInteractionsTable).values({
                wallet: body.wallet,
                productId: body.productId,
                typeDenominator: body.interaction.handlerTypeDenominator,
                interactionData: body.interaction.interactionData,
                signature: body.signature,
                status: "pending",
            });

            // Trigger the simulation job
            await (
                store as SimulateInteractionAppJob["store"]
            ).cron.simulateInteraction.trigger();
        },
        {
            isNexusAuthenticated: true,

            body: t.Object({
                wallet: t.Address(),
                productId: t.Hex(),
                interaction: t.Object({
                    handlerTypeDenominator: t.Hex(),
                    interactionData: t.Hex(),
                }),
                signature: t.Optional(t.Hex()),
            }),
        }
    );
