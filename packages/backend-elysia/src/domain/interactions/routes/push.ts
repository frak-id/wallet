import { log, walletSdkSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isAddressEqual } from "viem";
import { interactionsContext } from "../context";
import { pendingInteractionsTable } from "../db/schema";
import { InteractionRequestDto } from "../dto/InteractionDto";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .use(walletSdkSessionContext)
    .post(
        "/push",
        async ({
            body: { interactions },
            walletSdkSession,
            error,
            interactionsDb,
            store,
        }) => {
            if (!walletSdkSession) return;

            // Ensure no wallet mismatch
            if (
                interactions.some(
                    (interaction) =>
                        !isAddressEqual(
                            walletSdkSession.address,
                            interaction.wallet
                        )
                )
            ) {
                return error(403, "Invalid wallet address");
            }
            log.debug(`Received ${interactions.length} interactions`);

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
            store.emitter.emit("newInteractions");

            // Return the inserted ids
            return results.map((result) => result.insertedId.toString());
        },
        {
            authenticated: "wallet-sdk",
            body: t.Object({
                interactions: t.Array(InteractionRequestDto),
            }),
            result: {
                403: t.String(),
                200: t.Array(t.String()),
            },
        }
    );
