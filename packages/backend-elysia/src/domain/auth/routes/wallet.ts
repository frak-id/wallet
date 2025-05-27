import { blockchainContext, log, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import {
    type RegistrationResponseJSON,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Elysia, error } from "elysia";
import { Binary } from "mongodb";
import { verifyMessage } from "viem/actions";
import { sixDegreesContext } from "../../../domain/6degrees/context";
import {
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
} from "../models/WalletSessionDto";
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
    )
    // Ecdsa login
    .post(
        "/ecdsaLogin",
        async ({
            // Request
            body: { expectedChallenge, signature, wallet, ssoId, demoPkey },
            // Context
            client,
            walletJwt,
            generateSdkJwt,
            webAuthNService,
            ssoService,
        }) => {
            // Rebuild the message that have been signed
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${expectedChallenge}`;

            // Verify the message signature
            const isValidSignature = await verifyMessage(client, {
                signature,
                message,
                address: wallet,
            });
            if (!isValidSignature) {
                return error(404, "Invalid signature");
            }

            const authenticatorId = `ecdsa-${wallet}` as const;

            // Get the wallet address
            const walletAddress = await webAuthNService.getEcdsaWalletAddress({
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
            const sdkJwt = await generateSdkJwt({
                wallet: walletAddress,
                additionalData: { demoPkey },
            });

            // If all good, mark the sso as done
            if (ssoId) {
                await ssoService.resolveSession({
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
            generateSdkJwt,
            webAuthNService,
            ssoService,
            sixDegrees,
        }) => {
            // Check if that's a valid webauthn signature
            const verificationnResult = await webAuthNService.isValidSignature({
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
                await sixDegrees.routingService.isRoutedWallet(address);
            if (isSixDegrees) {
                const token = await sixDegrees.authenticationService.login({
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
            const sdkJwt = await generateSdkJwt({
                wallet: address,
                additionalData,
            });

            // If all good, mark the sso as done
            if (ssoId) {
                await ssoService.resolveSession({
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
                isSixDegrees,
            },
            // Context
            generateSdkJwt,
            walletJwt,
            webAuthNService,
            ssoService,
            sixDegrees,
        }) => {
            // Decode the registration response
            const registrationResponse =
                webAuthNService.parseCompressedResponse<RegistrationResponseJSON>(
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
                (await webAuthNService.getWalletAddress({
                    authenticatorId: credential.id,
                    pubKey: publicKey,
                }));
            await webAuthNService.authenticatorRepository.createAuthenticator({
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

            // Prepare the additional data object
            const additionalData: StaticWalletSdkTokenDto["additionalData"] =
                {};

            // If that's a six degrees wallet, register it
            if (isSixDegrees) {
                await sixDegrees.routingService.registerRoutedWallet(
                    walletAddress
                );
                const token = await sixDegrees.authenticationService.register({
                    publicKey: credential.publicKey,
                    challenge: expectedChallenge,
                    signature: rawRegistrationResponse,
                });
                if (token) {
                    additionalData.sixDegreesToken = token;
                }
            }

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({
                wallet: walletAddress,
                additionalData,
            });

            // If all good, mark the sso as done
            if (ssoId) {
                await ssoService.resolveSession({
                    id: ssoId,
                    wallet: walletAddress,
                    authenticatorId: credential.id,
                    additionalData,
                });
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: walletAddress,
                type: "webauthn",
                authenticatorId: credential.id,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });

            return {
                token,
                type: "webauthn",
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
                ssoId: t.Optional(t.Hex()),
                // potential routing request
                isSixDegrees: t.Optional(t.Boolean()),
            }),
            response: {
                400: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
