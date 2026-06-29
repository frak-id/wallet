import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status, t } from "elysia";
import type {
    StaticWalletSdkTokenDto,
    StaticWalletTokenDto,
} from "../../domain/auth/models/WalletSessionDto";
import { JwtContext } from "../external/jwt";
import { AUTH_ERROR_HEADER, AuthErrorCode } from "./authError";

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
            async resolve({ headers, set }) {
                const walletAuth = headers["x-wallet-auth"];
                if (!walletAuth) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.walletTokenInvalid;
                    return status(401, "Unauthorized");
                }
                const auth = await JwtContext.wallet.verify(walletAuth);
                if (!auth) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.walletTokenInvalid;
                    return status(401, "Unauthorized");
                }
                // Return the auth
                return { walletSession: auth };
            },
        },
        withWalletOrSdkAuthent: {
            async resolve({ headers, set }) {
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

                // Neither credential resolved (wallet token absent/invalid AND
                // sdk token absent/invalid). Tagged `wallet-token-invalid`
                // because re-establishing the wallet session is the required
                // recovery here regardless of which header was sent: the client
                // only ever omits the wallet token when no session exists, so a
                // re-auth prompt is always the correct response.
                set.headers[AUTH_ERROR_HEADER] =
                    AuthErrorCode.walletTokenInvalid;
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
            async resolve({ headers, set }) {
                const walletSdkAuth = headers["x-wallet-sdk-auth"];
                if (!walletSdkAuth) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.sdkTokenInvalid;
                    return status(401, "Unauthorized");
                }
                const auth = await JwtContext.walletSdk.verify(walletSdkAuth);
                if (!auth) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.sdkTokenInvalid;
                    return status(401, "Unauthorized");
                }
                // Return the auth
                return { walletSdkSession: auth };
            },
        },
    })
    .as("scoped");
