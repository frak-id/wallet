import {
    db,
    eventEmitter,
    interactionDiamondRepository,
    log,
} from "@backend-common";
import { t, validateBodyHmac } from "@backend-utils";
import { interactionTypes } from "@frak-labs/core-sdk";
import {
    PurchaseInteractionEncoder,
    RetailInteractionEncoder,
} from "@frak-labs/core-sdk/interactions";
import { eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { type Hex, isAddress, isHex, keccak256, toHex } from "viem";
import {
    backendTrackerTable,
    pendingInteractionsTable,
} from "../../../domain/interactions";

export const interactionsApi = new Elysia({ prefix: "/interactions" })
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
        headers: t.Partial(
            t.Object({
                "x-hmac-sha256": t.String(),
            })
        ),
    })
    .resolve(({ params: { productId }, headers }) => {
        if (!productId) {
            return status(400, "Invalid product id");
        }
        if (!headers["x-hmac-sha256"]) {
            return status(400, "Missing hmac");
        }

        return { productId, hmac: headers["x-hmac-sha256"] };
    })
    .decorate(
        "saveInteractions",
        async (
            interactions: (typeof pendingInteractionsTable.$inferInsert)[]
        ) => {
            await db
                .insert(pendingInteractionsTable)
                .values(interactions)
                .onConflictDoNothing();
            // Trigger the simulation job (and don't wait for it)
            eventEmitter.emit("newInteractions");
        }
    )
    // Direct push an interaction
    .post(
        "/push",
        async ({
            // Request
            productId,
            hmac,
            body: rawBody,
            // Context
            saveInteractions,
        }) => {
            // Validate the body received
            const body = JSON.parse(rawBody);
            const isValidBody =
                body.wallet && body.interaction && isAddress(body.wallet);
            if (!isValidBody) {
                return status(400, "Invalid body");
            }

            // Find the product backend tracker for this product id
            const tracker = await db.query.backendTrackerTable.findFirst({
                where: eq(backendTrackerTable.productId, productId),
            });
            if (!tracker) {
                return status(404, "Product backend tracker not found");
            }

            // Validate the body hmac
            validateBodyHmac({
                body: rawBody,
                secret: tracker.hookSignatureKey,
                signature: hmac,
            });

            // Get the diamond contract for this product
            const diamond =
                await interactionDiamondRepository.getDiamondContract(
                    productId
                );
            if (!diamond) {
                return status(400, "No diamond found for the product");
            }

            // Insert the interaction in the pending state
            await saveInteractions([
                {
                    wallet: body.wallet,
                    productId,
                    typeDenominator: body.interaction.handlerTypeDenominator,
                    interactionData: body.interaction.interactionData,
                    signature: body.signature ?? undefined,
                    status: "pending",
                },
            ]);
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                productId: t.Optional(t.Hex()),
            }),
        }
    )
    // Direct push a raw interaction (non formatted)
    .post(
        "/pushRaw",
        async ({
            // Request
            productId,
            hmac,
            body: rawBody,
            // Context
            saveInteractions,
        }) => {
            // Validate the body received
            const body = JSON.parse(rawBody);
            const isValidBody =
                body.wallet && body.key && body.data && isAddress(body.wallet);
            if (!isValidBody) {
                return status(400, "Invalid body");
            }

            // Find the product backend tracker for this product id
            const tracker = await db.query.backendTrackerTable.findFirst({
                where: eq(backendTrackerTable.productId, productId),
            });
            if (!tracker) {
                return status(404, "Product backend tracker not found");
            }

            // Validate the body hmac
            validateBodyHmac({
                body: rawBody,
                secret: tracker.hookSignatureKey,
                signature: hmac,
            });

            // Ensure it's an allowed raw push interaction
            const interaction = mapRawInteraction(body);
            if (!interaction) {
                return status(400, "Invalid raw interaction");
            }

            // Get the diamond contract for this product
            const diamond =
                await interactionDiamondRepository.getDiamondContract(
                    productId
                );
            if (!diamond) {
                return status(400, "No diamond found for the product");
            }

            // Insert the interaction in the pending state
            await saveInteractions([
                {
                    wallet: body.wallet,
                    productId,
                    typeDenominator: interaction.handlerTypeDenominator,
                    interactionData: interaction.interactionData,
                    status: "pending",
                },
            ]);
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                productId: t.Optional(t.Hex()),
            }),
        }
    );

/**
 * Map raw interaction to interaction data
 */
function mapRawInteraction({
    key,
    data,
}: {
    key: Hex;
    data: unknown[];
}): { handlerTypeDenominator: Hex; interactionData: Hex } | undefined {
    switch (key) {
        // Case of a customer meeting interaction
        case interactionTypes.retail.customerMeeting: {
            if (data.length !== 1) {
                log.warn("Invalid data length for customer meeting", {
                    key,
                    data,
                });
                return undefined;
            }
            const agency = data[0];
            if (typeof agency !== "string") {
                log.warn("Invalid data type for customer meeting", {
                    key,
                    data,
                });
                return undefined;
            }
            // Otherwise, return the formatted interaction
            return RetailInteractionEncoder.customerMeeting({
                agencyId: isHex(agency) ? agency : keccak256(toHex(agency)),
            });
        }
        // Case of an unsafe purchase
        case interactionTypes.purchase.unsafeCompleted: {
            if (data.length !== 1) {
                log.warn("Invalid data length for purchase", {
                    key,
                    data,
                });
                return undefined;
            }
            const purchaseId = data[0];
            if (typeof purchaseId !== "string") {
                log.warn("Invalid data type for purchase", {
                    key,
                    data,
                });
                return undefined;
            }
            // Otherwise, return the formatted interaction
            return PurchaseInteractionEncoder.unsafeCompletedPurchase({
                purchaseId: isHex(purchaseId)
                    ? purchaseId
                    : keccak256(toHex(purchaseId)),
            });
        }
    }

    // Unknown interaction
    log.warn("Interaction not allowed as raw interaction, aborting", {
        key,
        data,
    });
    return undefined;
}
