import { JwtContext } from "@backend-common";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";

/**
 * Some default auth cookies props
 */
const defaultCookiesProps = {
    domain: isRunningLocally ? "localhost" : ".frak.id",
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    secure: true,
} as const;

export const sessionContext = new Elysia({
    name: "Macro.session",
    cookie: defaultCookiesProps,
})
    .macro({
        withWalletAuthent: {
            async resolve({ headers }) {
                const walletAuth = headers["x-wallet-auth"];
                if (!walletAuth) {
                    return status(401, "Unauthorized");
                }
                const auth = await JwtContext.wallet.verify(walletAuth);
                if (!auth) {
                    return status(401, "Unauthorized");
                }
                // Return the auth
                return { walletSession: auth };
            },
        },
        withWalletSdkAuthent: {
            async resolve({ headers }) {
                const walletSdkAuth = headers["x-wallet-sdk-auth"];
                if (!walletSdkAuth) {
                    return status(401, "Unauthorized");
                }
                const auth = await JwtContext.walletSdk.verify(walletSdkAuth);
                if (!auth) {
                    return status(401, "Unauthorized");
                }
                // Return the auth
                return { walletSdkSession: auth };
            },
        },
    })
    .as("scoped");
