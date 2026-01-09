import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import {
    type RegistrationResponseJSON,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Elysia, status } from "elysia";
import { Binary } from "mongodb";
import type { PublicKeyCredential } from "ox/WebAuthnP256";
import {
    AuthContext,
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
} from "../../../../../domain/auth";
import { IdentityContext } from "../../../../../domain/identity";

const identityHeadersSchema = t.Object({
    "x-frak-client-id": t.Optional(t.String()),
});

export const registerRoutes = new Elysia()
    .guard({
        headers: identityHeadersSchema,
    })
    .post(
        "/register",
        async ({
            headers,
            body: {
                id,
                publicKey,
                raw: rawRegistrationResponse,
                userAgent,
                previousWallet,
                merchantId,
            },
        }) => {
            // Decode the registration response
            const registrationResponse =
                AuthContext.services.webAuthN.parseCompressedResponse<PublicKeyCredential>(
                    rawRegistrationResponse
                );

            // Verify the registration response
            // Use rpAllowedIds to accept both web (frak.id) and Tauri mobile (wallet-dev.frak.id) clients
            const verification = await verifyRegistrationResponse({
                response:
                    registrationResponse as unknown as RegistrationResponseJSON,
                expectedChallenge: (challenge) => {
                    console.log("Challenge", challenge);
                    return true;
                },
                expectedRPID: WebAuthN.rpAllowedIds,
                expectedOrigin: WebAuthN.rpAllowedOrigins,
            });
            if (!verification.verified) {
                log.error(
                    {
                        verification,
                    },
                    "Registration of a new authenticator failed"
                );
                return status(400, "Registration failed");
            }

            // Extract the info we want to store
            const { credential, credentialDeviceType, credentialBackedUp } =
                verification.registrationInfo;

            // Get the wallet address
            const walletAddress =
                previousWallet ??
                (await AuthContext.services.webAuthN.getWalletAddress({
                    authenticatorId: credential.id,
                    pubKey: publicKey,
                }));
            await AuthContext.repositories.authenticator.createAuthenticator({
                _id: id,
                smartWalletAddress: walletAddress,
                userAgent,
                credentialPublicKey: new Binary(credential.publicKey),
                counter: credential.counter,
                credentialDeviceType,
                credentialBackedUp,
                publicKey,
                transports: credential.transports,
            });

            // Prepare the additional data object
            const additionalData: StaticWalletSdkTokenDto["additionalData"] =
                {};

            const sdkJwt =
                await AuthContext.services.walletSdkSession.generateSdkJwt({
                    wallet: walletAddress,
                    additionalData,
                });

            const token = await JwtContext.wallet.sign({
                address: walletAddress,
                type: "webauthn",
                authenticatorId: credential.id,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });

            const clientId = headers["x-frak-client-id"];
            if (clientId || merchantId) {
                await IdentityContext.services.identityResolution
                    .connectWallet({
                        wallet: walletAddress,
                        clientId,
                        merchantId,
                    })
                    .catch((err: unknown) => {
                        log.error(
                            { err, walletAddress, clientId, merchantId },
                            "Failed to connect wallet to identity"
                        );
                    });
            }

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
                id: t.String(),
                publicKey: t.Object({
                    x: t.Hex(),
                    y: t.Hex(),
                    prefix: t.Number(),
                }),
                raw: t.String(),
                userAgent: t.String(),
                previousWallet: t.Optional(t.Address()),
                setSessionCookie: t.Optional(t.Boolean()),
                merchantId: t.Optional(t.String({ format: "uuid" })),
            }),
            response: {
                400: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
