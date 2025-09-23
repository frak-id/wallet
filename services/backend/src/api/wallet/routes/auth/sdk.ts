import { sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { isAddressEqual } from "viem";
import { AuthContext } from "../../../../domain/auth";

export const walletSdkRoutes = new Elysia({ prefix: "/sdk" })
    .use(sessionContext)
    // Generate a new token
    .get(
        "/generate",
        async ({ walletSession }) => {
            return await AuthContext.services.walletSdkSession.generateSdkJwt({
                wallet: walletSession.address,
            });
        },
        {
            withWalletAuthent: true,
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
        async ({ body: { signature, msg, wallet } }) => {
            // Check the validity of the webauthn signature
            const verificationnResult =
                await AuthContext.services.webAuthN.isValidSignature({
                    compressedSignature: signature,
                    msg,
                });

            // If not valid, return an error
            if (!verificationnResult) {
                return status(403, "Invalid signature");
            }

            // If it's not the same wallet, return an error
            if (!isAddressEqual(verificationnResult.address, wallet)) {
                return status(403, "Invalid signature");
            }

            // Otherwise generate a new token
            return await AuthContext.services.walletSdkSession.generateSdkJwt({
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
    .get(
        "/isValid",
        async ({ walletSdkSession }) => {
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
            withWalletSdkAuthent: true,
            response: {
                401: t.String(),
                200: t.Object({
                    isValid: t.Boolean(),
                }),
            },
        }
    );
