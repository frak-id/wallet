import { log, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, error } from "elysia";
import { sixDegreesContext } from "../../../../domain/6degrees/context";
import { WalletAuthResponseDto, authContext } from "../../../../domain/auth";
import { loginRoutes } from "./login";
import { registerRoutes } from "./register";
import { routingRoutes } from "./routing";
import { walletSdkRoutes } from "./sdk";
import { walletSsoRoutes } from "./sso";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(sessionContext)
    .use(authContext)
    // SSO + sdk sub routes
    .use(walletSsoRoutes)
    .use(walletSdkRoutes)
    // Login + register routes
    .use(loginRoutes)
    .use(registerRoutes)
    // Routing (only for 6degrees)
    .use(routingRoutes)
    // Six Degrees context
    .use(sixDegreesContext)
    // Logout
    .post("/logout", async ({ cookie: { businessAuth } }) => {
        businessAuth.remove();
    })
    // Decode token
    .get(
        "/session",
        async ({ headers: { "x-wallet-auth": walletAuth }, walletJwt }) => {
            if (!walletAuth) {
                return error(404, "No wallet session found");
            }

            // Decode it
            const decodedSession = await walletJwt.verify(walletAuth);
            if (!decodedSession) {
                log.error({ decodedSession }, "Error decoding session");
                return error(404, "Invalid wallet session");
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
