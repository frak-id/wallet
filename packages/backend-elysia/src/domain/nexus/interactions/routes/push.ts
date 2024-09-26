import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isAddressEqual } from "viem";
import { pendingInteractionsTable } from "../../db/schema";
import { interactionsContext } from "../context";
import { InteractionRequestDto } from "../dto/InteractionDto";
import type { SimulateInteractionAppJob } from "../jobs/simulate";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/push",
        async ({
            body: { interactions },
            session,
            error,
            interactionsDb,
            store,
        }) => {
            if (!session) return;

            // Ensure no wallet mismatch
            if (
                interactions.some(
                    (interaction) =>
                        !isAddressEqual(
                            session.wallet.address,
                            interaction.wallet
                        )
                )
            ) {
                return error(403, "Invalid wallet address");
            }
            console.log("Pushing interactions", interactions);

            // Map the interaction for the db insertion
            const interactionsForInsert = interactions.map(
                (interaction) =>
                    ({
                        wallet: interaction.wallet,
                        productId: interaction.productId,
                        typeDenominator:
                            interaction.interaction.handlerTypeDenominator,
                        interactionData:
                            interaction.interaction.interactionData,
                        signature: interaction.signature ?? undefined,
                        status: "pending",
                    }) as const
            );

            // Insert it in the pending state
            const results = await interactionsDb
                .insert(pendingInteractionsTable)
                .values(interactionsForInsert)
                .onConflictDoNothing()
                .returning({ insertedId: pendingInteractionsTable.id });

            // Trigger the simulation job (and don't wait for it)
            (
                store as SimulateInteractionAppJob["store"]
            ).cron.simulateInteraction.trigger();

            // Return the inserted ids
            return results.map((result) => result.insertedId.toString());
        },
        {
            isNexusAuthenticated: false,
            body: t.Object({
                interactions: t.Array(InteractionRequestDto),
            }),
            result: {
                403: t.String(),
                200: t.Array(t.String()),
            },
        }
    );
