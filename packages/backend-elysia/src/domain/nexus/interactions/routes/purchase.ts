import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsPurchaseTrackerTable } from "../../db/interactions";
import { interactionsContext } from "../context";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/listenForPurchase",
        async ({ body, interactionsDb }) => {
            // todo: Additional security measures, scoped JWT would be ideal
            // Insert the purchase tracker
            await interactionsDb
                .insert(interactionsPurchaseTrackerTable)
                .values({
                    wallet: body.wallet,
                    externalCustomerId: body.customerId,
                    externalPurchaseId: body.orderId,
                    token: body.token,
                });
        },
        {
            isNexusAuthenticated: false,

            body: t.Object({
                wallet: t.Address(),
                customerId: t.String(),
                orderId: t.String(),
                token: t.String(),
            }),
        }
    );
