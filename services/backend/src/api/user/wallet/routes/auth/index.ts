import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { WalletAuthResponseDto } from "../../../../../domain/auth";
import { loginRoutes } from "./login";
import { registerRoutes } from "./register";
import { routingRoutes } from "./routing";
import { walletSdkRoutes } from "./sdk";

export const authRoutes = new Elysia({ prefix: "/auth" })
    // SSO + sdk sub routes
    .use(walletSdkRoutes)
    // Login + register routes
    .use(loginRoutes)
    .use(registerRoutes)
    // Routing (only for 6degrees)
    .use(routingRoutes)
    // Logout
    .post("/logout", async ({ cookie: { businessAuth } }) => {
        businessAuth.remove();
    })
    // Decode token
    .get(
        "/session",
        async ({ headers: { "x-wallet-auth": walletAuth } }) => {
            if (!walletAuth) {
                return status(404, "No wallet session found");
            }

            // Decode it
            const decodedSession = await JwtContext.wallet.verify(walletAuth);
            if (!decodedSession) {
                log.error({ decodedSession }, "Error decoding session");
                return status(404, "Invalid wallet session");
            }

            return { ...decodedSession, token: walletAuth };
        },
        {
            response: {
                404: t.String(),
                200: t.Omit(WalletAuthResponseDto, ["sdkJwt"]),
            },
        }
    );
