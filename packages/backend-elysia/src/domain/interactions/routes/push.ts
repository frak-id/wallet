import { log, walletSdkSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { sixDegreesContext } from "domain/6degrees/context";
import { Elysia } from "elysia";
import { sift } from "radash";
import { isAddressEqual } from "viem";
import { interactionsContext } from "../context";
import { pendingInteractionsTable } from "../db/schema";
import { InteractionRequestDto } from "../dto/InteractionDto";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .use(walletSdkSessionContext)
    .use(sixDegreesContext)
    .post(
        "/push",
        async ({
            body: { interactions },
            walletSdkSession,
            error,
            interactionsDb,
            emitter,
            interactionDiamondRepository,
            sixDegrees,
        }) => {
            if (!walletSdkSession) return;
            if (!interactions.length) {
                return;
            }

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

            // Check if the user got a sixdegrees token
            if (walletSdkSession.additionalData?.sixDegreesToken) {
                log.info("Pushing interactions to 6degrees");
                await sixDegrees.interactionService.pushInteraction(
                    interactions.map((interaction) => interaction.interaction),
                    walletSdkSession.additionalData?.sixDegreesToken
                );
                return;
            }

            // Map the interaction for the db insertion
            const interactionsForInsertPromise = interactions.map(
                async (interaction) => {
                    const diamond =
                        await interactionDiamondRepository.getDiamondContract(
                            interaction.productId
                        );
                    // If no diamond found, it mean that we don't havy any interaction contract for this product
                    if (!diamond) {
                        log.warn(
                            {
                                productId: interaction.productId,
                            },
                            "No diamond found for the product"
                        );
                        return null;
                    }

                    return {
                        wallet: interaction.wallet,
                        productId: interaction.productId,
                        typeDenominator:
                            interaction.interaction.handlerTypeDenominator,
                        interactionData:
                            interaction.interaction.interactionData,
                        signature: interaction.signature ?? undefined,
                        status: "pending",
                    } as const;
                }
            );

            const interactionsForInsert = sift(
                await Promise.all(interactionsForInsertPromise)
            );
            if (!interactionsForInsert.length) {
                log.warn("No interaction to insert post filter");
                return;
            }

            // Insert it in the pending state
            const results = await interactionsDb
                .insert(pendingInteractionsTable)
                .values(interactionsForInsert)
                .onConflictDoNothing()
                .returning({ insertedId: pendingInteractionsTable.id });

            // Trigger the simulation job (and don't wait for it)
            emitter.emit("newInteractions");

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
