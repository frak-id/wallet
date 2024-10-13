import { nextSessionContext, sessionContext } from "@backend-common";
import { Elysia } from "elysia";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(nextSessionContext)
    .use(sessionContext)
    // todo: wallet auth endpoint
    .post("/sign", async ({ walletSession, walletSdkJwt, error }) => {
        if (!walletSession) {
            return error(401, "Unauthorized");
        }

        // todo: Authenticator + webauthn verifications
        // todo: Generate auth cookie plus set it
        // todo: endpoint to get session informations

        walletSdkJwt.sign({
            wallet: walletSession.wallet.address,
            scopes: ["interaction"],
            iss: "frak.id",
            sub: walletSession.wallet.address,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        });
    });
