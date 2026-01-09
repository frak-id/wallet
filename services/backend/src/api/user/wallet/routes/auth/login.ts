import { JwtContext, log, viemClient } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { verifyMessage } from "viem/actions";
import {
    AuthContext,
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
} from "../../../../../domain/auth";
import { IdentityContext } from "../../../../../domain/identity";

const identityHeadersSchema = t.Object({
    "x-frak-client-id": t.Optional(t.String()),
});

export const loginRoutes = new Elysia()
    .guard({
        headers: identityHeadersSchema,
    })
    .post(
        "/ecdsaLogin",
        async ({
            headers,
            body: {
                expectedChallenge,
                signature,
                wallet,
                demoPkey,
                merchantId,
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
                return status(404, "Invalid signature");
            }

            const authenticatorId = `ecdsa-${wallet}` as const;

            // Get the wallet address
            const walletAddress =
                await AuthContext.services.webAuthN.getEcdsaWalletAddress({
                    ecdsaAddress: wallet,
                });

            // Create the token and set the cookie
            const token = await JwtContext.wallet.sign({
                type: "ecdsa",
                address: walletAddress,
                authenticatorId,
                publicKey: wallet,
                sub: walletAddress,
                iat: Date.now(),
                transports: undefined,
            });

            const sdkJwt =
                await AuthContext.services.walletSdkSession.generateSdkJwt({
                    wallet: walletAddress,
                    additionalData: { demoPkey },
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
                demoPkey: t.Optional(t.Hex()),
                merchantId: t.Optional(t.String({ format: "uuid" })),
            }),
            response: {
                404: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    )
    .post(
        "/login",
        async ({
            headers,
            body: {
                authenticatorResponse: rawAuthenticatorResponse,
                expectedChallenge,
                merchantId,
            },
        }) => {
            // Check if that's a valid webauthn signature
            const verificationnResult =
                await AuthContext.services.webAuthN.isValidSignature({
                    compressedSignature: rawAuthenticatorResponse,
                    challenge: expectedChallenge,
                });
            if (!verificationnResult) {
                return status(404, "Invalid signature");
            }

            // Otherwise all good, extract a few info
            const { address, authenticatorId, publicKey, transports } =
                verificationnResult;

            // Prepare the additional data object
            const additionalData: StaticWalletSdkTokenDto["additionalData"] =
                {};

            // Create the token and set the cookie
            const token = await JwtContext.wallet.sign({
                type: "webauthn",
                address,
                authenticatorId,
                publicKey,
                transports,
                sub: address,
                iat: Date.now(),
            });

            const sdkJwt =
                await AuthContext.services.walletSdkSession.generateSdkJwt({
                    wallet: address,
                    additionalData,
                });

            const clientId = headers["x-frak-client-id"];
            if (clientId || merchantId) {
                await IdentityContext.services.identityResolution
                    .connectWallet({
                        wallet: address,
                        clientId,
                        merchantId,
                    })
                    .catch((err: unknown) => {
                        log.error(
                            { err, address, clientId, merchantId },
                            "Failed to connect wallet to identity"
                        );
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
                expectedChallenge: t.Hex(),
                authenticatorResponse: t.String(),
                merchantId: t.Optional(t.String({ format: "uuid" })),
            }),
            response: {
                404: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
