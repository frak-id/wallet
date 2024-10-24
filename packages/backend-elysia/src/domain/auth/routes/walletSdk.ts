import { walletSdkSessionContext, walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isAddressEqual } from "viem";
import { walletSdkSessionService } from "../services/WalletSdkSessionService";
import { webAuthNService } from "../services/WebAuthNService";

export const walletSdkAuthRoutes = new Elysia({ prefix: "/walletSdk" })
    .use(walletSessionContext)
    .use(webAuthNService)
    .use(walletSdkSessionService)
    // Generate a new token
    .get(
        "/generate",
        async ({ walletSession, error, generateSdkJwt }) => {
            if (!walletSession) {
                return error(401, "Unauthorized");
            }
            return await generateSdkJwt({ wallet: walletSession.address });
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    token: t.String(),
                    expires: t.Number(),
                }),
            },
        }
    )
    // Generate a new token from a previous webauthn signature
    .post(
        "/fromWebAuthNSignature",
        async ({
            body: { signature, msg, wallet },
            isValidWebAuthNSignature,
            generateSdkJwt,
            error,
        }) => {
            // Check the validity of the webauthn signature
            const verificationnResult = await isValidWebAuthNSignature({
                compressedSignature: signature,
                msg,
            });

            // If not valid, return an error
            if (!verificationnResult) {
                return error(403, "Invalid signature");
            }

            // If it's not the same wallet, return an error
            if (!isAddressEqual(verificationnResult.address, wallet)) {
                return error(403, "Invalid signature");
            }

            // Otherwise generate a new token
            return await generateSdkJwt({
                wallet: verificationnResult.address,
            });
        },
        {
            body: t.Object({
                msg: t.String(),
                signature: t.String(),
                wallet: t.Address(),
            }),
            response: {
                403: t.String(),
                200: t.Object({
                    token: t.String(),
                    expires: t.Number(),
                }),
            },
        }
    )
    .use(walletSdkSessionContext)
    .get(
        "/isValid",
        async ({ walletSdkSession }) => {
            if (!walletSdkSession) {
                return {
                    isValid: false,
                };
            }

            // Else check the expiration date if any
            const exp = walletSdkSession.exp;
            if (exp && exp < Date.now() / 1000) {
                return {
                    isValid: false,
                };
            }

            // Otherwise all good
            return {
                isValid: true,
            };
        },
        {
            response: {
                401: t.String(),
                200: t.Object({
                    isValid: t.Boolean(),
                }),
            },
        }
    );
