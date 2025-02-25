import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { walletContext } from "../context";

export const pendingBalanceRoutes = new Elysia({ prefix: "/pending-balance" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "",
        async ({ pendingBalanceRepository, walletSession, error }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Get the pending balance for the user
            const pendingBalance =
                await pendingBalanceRepository.getPendingBalance({
                    address: walletSession.address,
                });

            return {
                pendingBalance,
                // Convert to EUR (assuming 1:1 for simplicity, adjust if needed)
                pendingBalanceEur: pendingBalance,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    pendingBalance: t.Number(),
                    pendingBalanceEur: t.Number(),
                }),
            },
        }
    );
