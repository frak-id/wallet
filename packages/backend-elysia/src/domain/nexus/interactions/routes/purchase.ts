import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../context";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/listenForPurchase",
        async () => {
            // todo: Store mapping
            // todo: Precheck current status (if all good directly build and submit stuff)
            // todo: Otherwise expose endpoint to be called by business part? Or how to do the link between the two cleanly?
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
