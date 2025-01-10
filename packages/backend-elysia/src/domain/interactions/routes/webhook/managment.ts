import { nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { interactionsContext } from "../../context";
import { backendTrackerTable } from "../../db/schema";

export const webhookManagmentRoutes = new Elysia()
    .use(interactionsContext)
    .use(nextSessionContext)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .resolve(({ params: { productId }, error }) => {
        if (!productId) {
            return error(400, "Invalid product id");
        }

        return { productId };
    })
    // Status of a backend tracker
    .get(
        ":productId/status",
        async ({ productId, interactionsDb }) => {
            // Get the current tracker
            const currentTrackers = await interactionsDb
                .select()
                .from(backendTrackerTable)
                .where(eq(backendTrackerTable.productId, productId))
                .limit(1);
            const currentTracker = currentTrackers[0];
            if (!currentTracker) {
                return { setup: false };
            }

            // Return the oracle status
            return {
                setup: true,
                source: currentTracker.source,
                webhookSigninKey: currentTracker.hookSignatureKey,
            };
        },
        {
            nextAuthenticated: "business",
            response: t.Union([
                t.Object({
                    setup: t.Literal(false),
                }),
                t.Object({
                    setup: t.Literal(true),
                    source: t.Union([t.Literal("custom")]),
                    webhookSigninKey: t.String(),
                }),
            ]),
        }
    )
    // Setup of a tracker for a product
    .post(
        ":productId/setup",
        async ({ body, interactionsDb, productId, error }) => {
            if (!productId) {
                return error(400, "Invalid product id");
            }

            const { hookSignatureKey, source } = body;

            // todo: Role check for the wallet

            // Insert or update it
            await interactionsDb
                .insert(backendTrackerTable)
                .values({
                    productId,
                    hookSignatureKey,
                    source,
                })
                .onConflictDoUpdate({
                    target: [backendTrackerTable.productId],
                    set: {
                        hookSignatureKey,
                        source,
                    },
                })
                .execute();
        },
        {
            nextAuthenticated: "business",
            body: t.Object({
                hookSignatureKey: t.String(),
                source: t.Union([t.Literal("custom")]),
            }),
        }
    )
    .post(
        ":productId/delete",
        async ({ productId, interactionsDb, error }) => {
            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

            // Check if we already got a setup for this product (we could only have one)
            const existingTracker =
                await interactionsDb.query.backendTrackerTable.findFirst({
                    with: { productId },
                });
            if (!existingTracker) {
                return error(
                    404,
                    `Product ${productId} have no current tracker setup`
                );
            }

            // Remove it
            await interactionsDb
                .delete(backendTrackerTable)
                .where(eq(backendTrackerTable.productId, productId))
                .execute();
        },
        {
            nextAuthenticated: "business",
        }
    );
