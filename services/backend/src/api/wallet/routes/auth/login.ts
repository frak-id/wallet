import { sessionContext, viemClient } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, error } from "elysia";
import { verifyMessage } from "viem/actions";
import { sixDegreesContext } from "../../../../domain/6degrees/context";
import {
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
    authContext,
} from "../../../../domain/auth";

export const loginRoutes = new Elysia()
    .use(sessionContext)
    .use(authContext)
    .use(sixDegreesContext)
    // Ecdsa login
    .post(
        "/ecdsaLogin",
        async ({
            // Request
            body: { expectedChallenge, signature, wallet, ssoId, demoPkey },
            // Context
            walletJwt,
            auth: {
                services: { walletSdkSession, walletSso, webAuthN },
            },
        }) => {
            // Rebuild the message that have been signed
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${expectedChallenge}`;

            // Verify the message signature
            const isValidSignature = await verifyMessage(viemClient, {
                signature,
                message,
                address: wallet,
            });
            if (!isValidSignature) {
                return error(404, "Invalid signature");
            }

            const authenticatorId = `ecdsa-${wallet}` as const;

            // Get the wallet address
            const walletAddress = await webAuthN.getEcdsaWalletAddress({
                ecdsaAddress: wallet,
            });

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                type: "ecdsa",
                address: walletAddress,
                authenticatorId,
                publicKey: wallet,
                sub: walletAddress,
                iat: Date.now(),
                transports: undefined,
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await walletSdkSession.generateSdkJwt({
                wallet: walletAddress,
                additionalData: { demoPkey },
            });

            // If all good, mark the sso as done
            if (ssoId) {
                await walletSso.resolveSession({
                    id: ssoId,
                    wallet: walletAddress,
                    authenticatorId,
                    additionalData: {
                        demoPkey: demoPkey,
                    },
                });
            }

            return {
                token,
                type: "ecdsa",
                address: walletAddress,
                authenticatorId,
                publicKey: wallet,
                sdkJwt,
                transports: undefined,
            };
        },
        {
            body: t.Object({
                expectedChallenge: t.String(),
                wallet: t.Address(),
                signature: t.Hex(),
                // potential sso id
                ssoId: t.Optional(t.Hex()),
                // potential demo pkey
                demoPkey: t.Optional(t.Hex()),
            }),
            response: {
                404: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    )
    // Login
    .post(
        "/login",
        async ({
            // Request
            body: {
                authenticatorResponse: rawAuthenticatorResponse,
                expectedChallenge,
                ssoId,
            },
            // Context
            walletJwt,
            auth: {
                services: { walletSdkSession, walletSso, webAuthN },
            },
            sixDegrees,
        }) => {
            // Check if that's a valid webauthn signature
            const verificationnResult = await webAuthN.isValidSignature({
                compressedSignature: rawAuthenticatorResponse,
                msg: expectedChallenge,
            });
            if (!verificationnResult) {
                return error(404, "Invalid signature");
            }

            // Otherwise all good, extract a few info
            const {
                address,
                authenticatorId,
                publicKey,
                transports,
                rawPublicKey,
            } = verificationnResult;

            // Prepare the additional data object
            const additionalData: StaticWalletSdkTokenDto["additionalData"] =
                {};

            // Check if that's a six degrees wallet, and iuf yes, generate a token accordingly
            const isSixDegrees =
                await sixDegrees.services.routing.isRoutedWallet(address);
            if (isSixDegrees) {
                const token = await sixDegrees.services.authentication.login({
                    publicKey: rawPublicKey,
                    challenge: expectedChallenge,
                    signature: rawAuthenticatorResponse,
                });
                if (token) {
                    additionalData.sixDegreesToken = token;
                }
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                type: "webauthn",
                address,
                authenticatorId,
                publicKey,
                transports,
                sub: address,
                iat: Date.now(),
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await walletSdkSession.generateSdkJwt({
                wallet: address,
                additionalData,
            });

            // If all good, mark the sso as done
            if (ssoId) {
                await walletSso.resolveSession({
                    id: ssoId,
                    wallet: address,
                    authenticatorId,
                    additionalData,
                });
            }

            return {
                token,
                type: "webauthn",
                address,
                authenticatorId,
                publicKey,
                transports,
                sdkJwt,
            };
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the authenticator response
                authenticatorResponse: t.String(),
                // potential sso id
                ssoId: t.Optional(t.Hex()),
            }),
            response: {
                404: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
