import {
    db,
    eventEmitter,
    interactionDiamondRepository,
    log,
    sessionContext,
} from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { isAddressEqual } from "viem";
import { SixDegreesContext } from "../../../../domain/6degrees/context";
import {
    InteractionRequestDto,
    pendingInteractionsTable,
} from "../../../../domain/interactions";

export const pushInteractionsRoutes = new Elysia().use(sessionContext).post(
    "/push",
    async ({ body: { interactions }, walletSdkSession }) => {
        if (!interactions.length) {
            return [];
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
            return status(403, "Invalid wallet address");
        }
        log.debug(`Received ${interactions.length} interactions`);

        // Check if the user got a sixdegrees token
        if (walletSdkSession.additionalData?.sixDegreesToken) {
            log.info("Pushing interactions to 6degrees");
            await SixDegreesContext.services.interaction.pushInteraction(
                interactions.map((interaction) => interaction.interaction),
                walletSdkSession.additionalData?.sixDegreesToken
            );
            return ["6degrees"];
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
                    interactionData: interaction.interaction.interactionData,
                    signature: interaction.signature ?? undefined,
                    status: "pending",
                } as const;
            }
        );

        const interactionsForInsert = (
            await Promise.all(interactionsForInsertPromise)
        ).filter((v) => v !== null);
        if (!interactionsForInsert.length) {
            log.warn("No interaction to insert post filter");
            return [];
        }

        // Insert it in the pending state
        const results = await db
            .insert(pendingInteractionsTable)
            .values(interactionsForInsert)
            .onConflictDoNothing()
            .returning({ insertedId: pendingInteractionsTable.id });

        // Trigger the simulation job (and don't wait for it)
        eventEmitter.emit("newInteractions");

        // Return the inserted ids
        return results.map((result) => result.insertedId.toString());
    },
    {
        withWalletSdkAuthent: true,
        body: t.Object({
            interactions: t.Array(InteractionRequestDto),
        }),
        response: {
            403: t.String(),
            200: t.Array(t.String()),
        },
    }
);
