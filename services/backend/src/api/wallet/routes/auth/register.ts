import { JwtContext, log } from "@backend-common";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import {
    type RegistrationResponseJSON,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Elysia, status } from "elysia";
import { Binary } from "mongodb";
import { SixDegreesContext } from "../../../../domain/6degrees/context";
import {
    AuthContext,
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
} from "../../../../domain/auth";

export const registerRoutes = new Elysia()
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
                isSixDegrees,
            },
        }) => {
            // Decode the registration response
            const registrationResponse =
                AuthContext.services.webAuthN.parseCompressedResponse<RegistrationResponseJSON>(
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
                return status(400, "Registration failed");
            }

            // Get the public key
            const publicKey = AuthContext.services.webAuthN.decodePublicKey({
                credentialPubKey:
                    verification.registrationInfo.credential.publicKey,
            });

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
                await SixDegreesContext.services.routing.registerRoutedWallet(
                    walletAddress
                );
                const token =
                    await SixDegreesContext.services.authentication.register({
                        publicKey: credential.publicKey,
                        challenge: expectedChallenge,
                        signature: rawRegistrationResponse,
                    });
                if (token) {
                    additionalData.sixDegreesToken = token;
                }
            }

            // Finally, generate a JWT token for the SDK
            const sdkJwt =
                await AuthContext.services.walletSdkSession.generateSdkJwt({
                    wallet: walletAddress,
                    additionalData,
                });

            // Create the token and set the cookie
            const token = await JwtContext.wallet.sign({
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
                // potential routing request
                isSixDegrees: t.Optional(t.Boolean()),
            }),
            response: {
                400: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
