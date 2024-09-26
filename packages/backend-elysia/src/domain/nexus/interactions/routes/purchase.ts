import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../context";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/listenForPurchase",
        async ({ session }) => {
            if (!session) return;
        },
        {
            isNexusAuthenticated: true,

            body: t.Object({
                customerId: t.String(),
                orderId: t.String(),
            }),
        }
    );
