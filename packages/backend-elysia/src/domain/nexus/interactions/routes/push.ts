import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isAddressEqual } from "viem";
import { pendingInteractionsTable } from "../../db/schema";
import { interactionsContext } from "../context";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post(
        "/push",
        async ({ body, session, error, interactionsDb }) => {
            if (!session) return;

            // Ensure the address matches
            if (!isAddressEqual(session.wallet.address, body.wallet)) {
                return error(403, "Invalid wallet address");
            }

            // Insert it in the pending state
            interactionsDb.insert(pendingInteractionsTable).values({
                wallet: body.wallet,
                productId: body.productId,
                typeDenominator: body.interaction.handlerTypeDenominator,
                interactionData: body.interaction.interactionData,
                signature: body.signature,
                status: "pending",
            });

            // todo: generate a signature if needed
            // todo: save it
            // todo: trigger simulation job
            // todo: build interaction tx

            // todo: simulation job, iterate over every pending interaction and check them
            // todo: pusher job, iterate over every simulated tx and push them (checking if compression gain gas or not??)

            console.log("Pushing interaction", { body });
        },
        {
            isNexusAuthenticated: true,

            body: t.Object({
                wallet: t.Address(),
                productId: t.Hex(),
                interaction: t.Object({
                    handlerTypeDenominator: t.Hex(),
                    interactionData: t.Hex(),
                }),
                signature: t.Optional(t.Hex()),
            }),
        }
    );
