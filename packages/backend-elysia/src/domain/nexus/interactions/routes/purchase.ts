import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../context";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/listenForPurchase",
        async () => {
            return "ok";
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
