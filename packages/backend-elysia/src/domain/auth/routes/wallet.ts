import { blockchainContext, log, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { Elysia } from "elysia";
import { Binary } from "mongodb";
import { walletSdkSessionService } from "../services/WalletSdkSessionService";
import { webAuthNService } from "../services/WebAuthNService";
import { decodePublicKey } from "../utils/webauthnDecode";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(blockchainContext)
    .use(sessionContext)
    .use(webAuthNService)
    .use(walletSdkSessionService)
    // Logout
    .post("/logout", async ({ cookie: { walletAuth, businessAuth } }) => {
        walletAuth.update({
            value: "",
            maxAge: 0,
        });
        businessAuth.remove();
    })
    // Decode token
    .get(
        "/session",
        async ({ cookie: { walletAuth }, walletJwt, error }) => {
            if (!walletAuth.value) {
                return error(404, "No wallet session found");
            }

            // Decode it
            const decodedSession = await walletJwt.verify(walletAuth.value);
            if (!decodedSession) {
                log.error({ decodedSession }, "Error decoding session");
                return error(404, "Invalid wallet session");
            }
            return decodedSession;
        },
        {
            response: {
                404: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                }),
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
            },
            cookie: { walletAuth },
            // Response
            error,
            // Context
            isValidWebAuthNSignature,
            walletJwt,
            generateSdkJwt,
        }) => {
            // Check if that's a valid webauthn signature
            const verificationnResult = await isValidWebAuthNSignature({
                compressedSignature: rawAuthenticatorResponse,
                msg: expectedChallenge,
            });
            if (!verificationnResult) {
                return error(404, "Invalid signature");
            }

            // Otherwise all good, extract a few info
            const { address, authenticatorId, publicKey } = verificationnResult;

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address,
                authenticatorId,
                publicKey,
                sub: address,
                iat: Date.now(),
            });
            walletAuth.update({
                value: token,
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({ wallet: address });

            return {
                address,
                authenticatorId,
                publicKey,
                sdkJwt,
            };
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the authenticator response
                authenticatorResponse: t.String(),
            }),
            response: {
                404: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                    sdkJwt: t.Object({
                        token: t.String(),
                        expires: t.Number(),
                    }),
                }),
            },
        }
    )
    // Registration
    .post(
        "/register",
        async ({
            // Request
            body: {
                registrationResponse: rawRegistrationResponse,
                expectedChallenge,
                userAgent,
                setSessionCookie,
                previousWallet,
            },
            cookie: { walletAuth },
            // Response
            error,
            // Context
            generateSdkJwt,
            getAuthenticatorDb,
            walletJwt,
            getAuthenticatorWalletAddress,
            parseCompressedWebAuthNResponse,
        }) => {
            // Decode the registration response
            const registrationResponse =
                parseCompressedWebAuthNResponse<RegistrationResponseJSON>(
                    rawRegistrationResponse
                );

            // Verify the registration response
            const verification = await verifyRegistrationResponse({
                response: registrationResponse,
                expectedChallenge,
                expectedOrigin: WebAuthN.rpOrigin,
                expectedRPID: WebAuthN.rpId,
            });
            if (!verification.registrationInfo) {
                log.error(
                    {
                        verification,
                        expectedChallenge,
                        response: registrationResponse,
                        rpOrigin: WebAuthN.rpOrigin,
                        rpId: WebAuthN.rpId,
                    },
                    "Registration of a new authenticator failed"
                );
                return error(400, "Registration failed");
            }

            // Get the public key
            const publicKey = decodePublicKey({
                credentialPubKey:
                    verification.registrationInfo.credentialPublicKey,
            });

            // Extract the info we want to store
            const {
                credentialPublicKey,
                credentialID,
                counter,
                credentialDeviceType,
                credentialBackedUp,
            } = verification.registrationInfo;

            // Get the wallet address
            const walletAddress =
                previousWallet ??
                (await getAuthenticatorWalletAddress({
                    authenticatorId: credentialID,
                    pubKey: publicKey,
                }));
            const authenticatorDbRepository = await getAuthenticatorDb();
            await authenticatorDbRepository.createAuthenticator({
                _id: credentialID,
                smartWalletAddress: walletAddress,
                userAgent,
                credentialPublicKey: new Binary(credentialPublicKey),
                counter,
                credentialDeviceType,
                credentialBackedUp,
                publicKey,
                transports: registrationResponse.response.transports,
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({ wallet: walletAddress });

            // If we don't want to set the session cookie, return the wallet
            if (!setSessionCookie) {
                log.debug(
                    { walletAddress },
                    "Skipping session cookie registration"
                );
                return {
                    address: walletAddress,
                    authenticatorId: credentialID,
                    publicKey,
                    sdkJwt,
                };
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: walletAddress,
                authenticatorId: credentialID,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });
            walletAuth.update({
                value: token,
            });

            return {
                address: walletAddress,
                authenticatorId: credentialID,
                publicKey,
                sdkJwt,
            };
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the registration response
                registrationResponse: t.String(),
                userAgent: t.String(),
                previousWallet: t.Optional(t.Address()),
                setSessionCookie: t.Optional(t.Boolean()),
            }),
            response: {
                400: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                    sdkJwt: t.Object({
                        token: t.String(),
                        expires: t.Number(),
                    }),
                }),
            },
        }
    );
