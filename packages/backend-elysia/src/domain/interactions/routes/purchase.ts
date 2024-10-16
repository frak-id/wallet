import { log, walletSdkSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../context";
import { interactionsPurchaseTrackerTable } from "../db/schema";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .use(walletSdkSessionContext)
    .post(
        "/listenForPurchase",
        async ({ body, interactionsDb, walletSdkSession }) => {
            if (!walletSdkSession) return;

            log.debug(`Received purchase from ${body.customerId}`);

            // Insert the purchase tracker
            await interactionsDb
                .insert(interactionsPurchaseTrackerTable)
                .values({
                    wallet: walletSdkSession.address,
                    externalCustomerId: body.customerId,
                    externalPurchaseId: body.orderId,
                    token: body.token,
                });
        },
        {
            authenticated: "wallet-sdk",
            body: t.Object({
                customerId: t.String(),
                orderId: t.String(),
                token: t.String(),
            }),
        }
    );
