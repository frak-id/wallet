import { eventEmitter, log, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, error } from "elysia";
import { db } from "infrastructure/db";
import { type Address, isHex } from "viem";
import {
    interactionsContext,
    interactionsPurchaseTrackerTable,
} from "../../../../domain/interactions";

export const purchaseInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .use(sessionContext)
    .post(
        "/listenForPurchase",
        async ({
            body,
            headers: { "x-wallet-sdk-auth": walletSdkAuth },
            walletSdkJwt,
        }) => {
            if (!walletSdkAuth) return error(401, "Missing wallet SDK JWT");

            // Get the right address
            let address: Address;
            if (isHex(walletSdkAuth)) {
                // Condition required for initial implementation, should be updated in a later stage to enforce wallet session
                address = walletSdkAuth;
            } else {
                const session = await walletSdkJwt.verify(walletSdkAuth);
                if (!session) return error(401, "Invalid wallet SDK JWT");
                address = session.address;
            }

            log.debug(`Received purchase from ${body.customerId} - ${address}`);

            // Insert the purchase tracker
            await db
                .insert(interactionsPurchaseTrackerTable)
                .values({
                    wallet: address,
                    externalCustomerId:
                        typeof body.customerId !== "string"
                            ? body.customerId.toString()
                            : body.customerId,
                    externalPurchaseId:
                        typeof body.orderId !== "string"
                            ? body.orderId.toString()
                            : body.orderId,
                    token: body.token,
                })
                .onConflictDoNothing();

            // Emit the event
            eventEmitter.emit("newTrackedPurchase");
        },
        {
            parse: "json",
            body: t.Object({
                customerId: t.Union([t.String(), t.Number()]),
                orderId: t.Union([t.String(), t.Number()]),
                token: t.String(),
            }),
        }
    );
