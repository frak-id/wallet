import { bodyHmacContext } from "@backend-common";
import { t } from "@backend-utils";
import { Value } from "@sinclair/typebox/value";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { interactionsContext } from "../../context";
import { backendTrackerTable, pendingInteractionsTable } from "../../db/schema";
import { BackendInteractionDto } from "../../dto/InteractionDto";

export const webhookPushRoutes = new Elysia()
    .use(interactionsContext)
    .use(bodyHmacContext)
    .post(
        ":productId/push",
        async ({
            // Request
            params: { productId },
            headers,
            body: rawBody,
            // Response
            error,
            // Context
            validateBodyHmac,
            interactionsDb,
            emitter,
            interactionDiamondRepository,
        }) => {
            // Validate the body received
            const body = JSON.parse(rawBody);
            const isValidBody = Value.Check(BackendInteractionDto, body);
            if (!isValidBody) {
                return error(400, "Invalid body");
            }
            if (!productId) {
                return error(400, "Missing product id");
            }
            if (!headers["x-hmac-sha256"]) {
                return error(400, "Missing hmac");
            }

            // Find the product backend tracker for this product id
            const tracker =
                await interactionsDb.query.backendTrackerTable.findFirst({
                    where: eq(backendTrackerTable.productId, productId),
                });
            if (!tracker) {
                return error(404, "Product backend tracker not found");
            }

            // Validate the body hmac
            if (!headers["x-hmac-sha256"]) {
                return error(400, "Missing hmac");
            }
            validateBodyHmac({
                body: rawBody,
                secret: tracker.hookSignatureKey,
                signature: headers["x-hmac-sha256"],
            });

            // Get the diamond contract for this product
            const diamond =
                await interactionDiamondRepository.getDiamondContract(
                    productId
                );
            if (!diamond) {
                return error(400, "No diamond found for the product");
            }

            // Insert the interaction in the pending state
            await interactionsDb
                .insert(pendingInteractionsTable)
                .values({
                    wallet: body.wallet,
                    productId,
                    typeDenominator: body.interaction.handlerTypeDenominator,
                    interactionData: body.interaction.interactionData,
                    signature: body.signature ?? undefined,
                    status: "pending",
                })
                .onConflictDoNothing();

            // Trigger the simulation job (and don't wait for it)
            emitter.emit("newInteractions");
        },
        {
            parse: "text",
            body: t.String(),
            header: t.Partial(
                t.Object({
                    "x-hmac-sha256": t.String(),
                })
            ),
            params: t.Object({
                productId: t.Optional(t.Hex()),
            }),
        }
    );
