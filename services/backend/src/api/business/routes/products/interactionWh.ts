import { rolesRepository } from "@backend-common";
import { db } from "@backend-common";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { backendTrackerTable } from "../../../../domain/interactions";
import { businessSessionContext } from "../../middleware/session";

export const interactionsWhRoutes = new Elysia({
    prefix: "/interactionsWebhook",
})
    .use(businessSessionContext)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .resolve(({ params: { productId } }) => {
        if (!productId) {
            return status(400, "Invalid product id");
        }

        return { productId };
    })
    // Status of a backend tracker
    .get(
        "/status",
        async ({ productId }) => {
            // Get the current tracker
            const currentTrackers = await db
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
        "/setup",
        async ({ body, productId, businessSession }) => {
            if (!businessSession) {
                return status(401, "Unauthorized");
            }
            if (!productId) {
                return status(400, "Invalid product id");
            }

            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return status(401, "Unauthorized");
            }

            const { hookSignatureKey, source } = body;

            // Insert or update it
            await db
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
            body: t.Object({
                hookSignatureKey: t.String(),
                source: t.Union([t.Literal("custom")]),
            }),
        }
    )
    .post("/delete", async ({ productId, businessSession }) => {
        if (!businessSession) {
            return status(401, "Unauthorized");
        }
        const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
            wallet: businessSession.wallet,
            productId: BigInt(productId),
            role: productRoles.interactionManager,
        });
        if (!isAllowed) {
            return status(401, "Unauthorized");
        }

        // Check if we already got a setup for this product (we could only have one)
        const existingTrackers = await db
            .select({ id: backendTrackerTable.id })
            .from(backendTrackerTable)
            .where(eq(backendTrackerTable.productId, productId));
        if (!existingTrackers.length) {
            return status(
                404,
                `Product ${productId} have no current tracker setup`
            );
        }

        // Remove it
        await db
            .delete(backendTrackerTable)
            .where(eq(backendTrackerTable.productId, productId))
            .execute();
    });
