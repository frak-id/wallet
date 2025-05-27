import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, error } from "elysia";
import { walletContext } from "../context";

export const pendingBalanceRoutes = new Elysia({ prefix: "/pending-balance" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "",
        async ({ pendingBalanceRepository, walletSession }) => {
            if (!walletSession) return error(401, "Unauthorized");

            return pendingBalanceRepository.getPendingBalance({
                address: walletSession.address,
            });
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.TokenAmount,
            },
        }
    );
