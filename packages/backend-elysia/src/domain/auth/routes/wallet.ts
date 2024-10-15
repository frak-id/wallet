import { blockchainContext, log, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { Elysia } from "elysia";
import { Binary } from "mongodb";
import { WalletAuthResponseDto } from "../models/WalletSessionDto";
import { walletSdkSessionService } from "../services/WalletSdkSessionService";
import { webAuthNService } from "../services/WebAuthNService";
import { decodePublicKey } from "../utils/webauthnDecode";
import { walletSdkRoutes } from "./wallet/sdk";
import { walletSsoRoutes } from "./wallet/sso";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(blockchainContext)
    .use(sessionContext)
    .use(webAuthNService)
    .use(walletSdkSessionService)
    // SSO + sdk sub routes
    .use(walletSsoRoutes)
    .use(walletSdkRoutes)
    // Logout
    .post("/logout", async ({ cookie: { businessAuth } }) => {
        businessAuth.remove();
    })
    // Decode token
    .get(
        "/session",
        async ({
            headers: { "x-wallet-auth": walletAuth },
            walletJwt,
            error,
        }) => {
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
            // Response
            error,
            // Context
            isValidWebAuthNSignature,
            walletJwt,
            generateSdkJwt,
            resolveSsoSession,
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
            const { address, authenticatorId, publicKey, transports } =
                verificationnResult;

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address,
                authenticatorId,
                publicKey,
                transports,
                sub: address,
                iat: Date.now(),
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({ wallet: address });

            // If all good, mark the sso as done
            if (ssoId) {
                await resolveSsoSession({
                    id: ssoId,
                    wallet: address,
                    authenticatorId,
                });
            }

            return {
                token,
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
                ssoId: t.Optional(t.Number()),
            }),
            response: {
                404: t.String(),
                200: WalletAuthResponseDto,
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
                previousWallet,
                ssoId,
            },
            // Response
            error,
            // Context
            generateSdkJwt,
            getAuthenticatorDb,
            walletJwt,
            getAuthenticatorWalletAddress,
            parseCompressedWebAuthNResponse,
            resolveSsoSession,
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
                    verification.registrationInfo.credential.publicKey,
            });

            // Extract the info we want to store
            const { credential, credentialDeviceType, credentialBackedUp } =
                verification.registrationInfo;

            // Get the wallet address
            const walletAddress =
                previousWallet ??
                (await getAuthenticatorWalletAddress({
                    authenticatorId: credential.id,
                    pubKey: publicKey,
                }));
            const authenticatorDbRepository = await getAuthenticatorDb();
            await authenticatorDbRepository.createAuthenticator({
                _id: credential.id,
                smartWalletAddress: walletAddress,
                userAgent,
                credentialPublicKey: new Binary(credential.publicKey),
                counter: credential.counter,
                credentialDeviceType,
                credentialBackedUp,
                publicKey,
                transports: registrationResponse.response.transports,
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({ wallet: walletAddress });

            // If all good, mark the sso as done
            if (ssoId) {
                await resolveSsoSession({
                    id: ssoId,
                    wallet: walletAddress,
                });
                    authenticatorId: credentialID,
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: walletAddress,
                authenticatorId: credential.id,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });

            return {
                token,
                address: walletAddress,
                authenticatorId: credential.id,
                publicKey,
                transports: credential.transports,
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
                // potential sso id
                ssoId: t.Optional(t.Number()),
            }),
            response: {
                400: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
