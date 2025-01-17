import { nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
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
        async ({
            body,
            interactionsDb,
            productId,
            error,
            businessSession,
            rolesRepository,
        }) => {
            if (!businessSession) {
                return error(401, "Unauthorized");
            }
            if (!productId) {
                return error(400, "Invalid product id");
            }

            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return error(401, "Unauthorized");
            }

            const { hookSignatureKey, source } = body;

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
        async ({
            productId,
            interactionsDb,
            error,
            businessSession,
            rolesRepository,
        }) => {
            if (!businessSession) {
                return error(401, "Unauthorized");
            }
            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return error(401, "Unauthorized");
            }

            // Check if we already got a setup for this product (we could only have one)
            const existingTrackers = await interactionsDb
                .select({ id: backendTrackerTable.id })
                .from(backendTrackerTable)
                .where(eq(backendTrackerTable.productId, productId));
            if (!existingTrackers.length) {
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
