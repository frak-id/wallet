import { JwtContext } from "@backend-infrastructure";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status, t } from "elysia";
import type {
    StaticWalletSdkTokenDto,
    StaticWalletTokenDto,
} from "../../domain/auth/models/WalletSessionDto";

type OptionalWalletSession =
    | StaticWalletTokenDto
    | StaticWalletSdkTokenDto
    | undefined;

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
    .guard({
        headers: t.Object({
            "x-wallet-auth": t.Optional(t.String()),
            "x-wallet-sdk-auth": t.Optional(t.String()),
        }),
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
        withWalletOrSdkAuthent: {
            async resolve({ headers }) {
                const walletAuth = headers["x-wallet-auth"];
                if (walletAuth) {
                    const walletAuthSession =
                        await JwtContext.wallet.verify(walletAuth);
                    if (walletAuthSession) {
                        return { walletSession: walletAuthSession };
                    }
                }

                const walletSdkAuth = headers["x-wallet-sdk-auth"];
                if (walletSdkAuth) {
                    const walletSdkAuthSession =
                        await JwtContext.walletSdk.verify(walletSdkAuth);
                    if (walletSdkAuthSession) {
                        return { walletSession: walletSdkAuthSession };
                    }
                }

                return status(401, "Unauthorized");
            },
        },
        withOptionalWalletOrSdkAuthent: {
            async resolve({
                headers,
            }): Promise<{ walletSession: OptionalWalletSession }> {
                const walletAuth = headers["x-wallet-auth"];
                if (walletAuth) {
                    const walletAuthSession =
                        await JwtContext.wallet.verify(walletAuth);
                    if (walletAuthSession) {
                        return { walletSession: walletAuthSession };
                    }
                }

                const walletSdkAuth = headers["x-wallet-sdk-auth"];
                if (walletSdkAuth) {
                    const walletSdkAuthSession =
                        await JwtContext.walletSdk.verify(walletSdkAuth);
                    if (walletSdkAuthSession) {
                        return { walletSession: walletSdkAuthSession };
                    }
                }

                // No auth or invalid auth — return undefined session rather
                // than 401 so the route can decide how to react.
                return { walletSession: undefined };
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
