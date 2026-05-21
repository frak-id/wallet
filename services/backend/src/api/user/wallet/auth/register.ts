import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { WebAuthN } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import {
    type RegistrationResponseJSON,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Elysia, getSchemaValidator, status } from "elysia";
import type { PublicKeyCredential } from "ox/WebAuthnP256";
import {
    AuthContext,
    type StaticWalletSdkTokenDto,
    WalletAuthResponseDto,
} from "../../../../domain/auth";
import { IdentityContext } from "../../../../domain/identity/context";
import { OrchestrationContext } from "../../../../orchestration/context";
import { FrakClientIdHeaderSchema } from "../../../schemas";

// Format checks are intentionally lenient: invalid values are silently
// dropped at the handler level so a stray React event or unexpected encoding
// can never block a registration once the device passkey has been created.
const EmailType = t.String({ format: "email", maxLength: 320 });
const MerchantIdType = t.String({ format: "uuid", maxLength: 64 });

const emailValidator = getSchemaValidator(EmailType, {
    modules: t.Module({}),
});
const merchantIdValidator = getSchemaValidator(MerchantIdType, {
    modules: t.Module({}),
});

function sanitiseInputs(
    email?: string,
    merchantId?: string
): { email?: string; merchantId?: string } {
    const emailResult = email ? emailValidator.safeParse(email) : null;
    const merchantIdResult = merchantId
        ? merchantIdValidator.safeParse(merchantId)
        : null;

    if (emailResult && emailResult.data === null) {
        log.warn(
            { email, error: emailResult.error },
            "Dropping invalid email at registration; proceeding without it"
        );
    }
    if (merchantIdResult && merchantIdResult.data === null) {
        log.warn(
            { merchantId, error: merchantIdResult.error },
            "Dropping invalid merchantId at registration; proceeding without identity link"
        );
    }

    return {
        email: emailResult?.data ?? undefined,
        merchantId: merchantIdResult?.data ?? undefined,
    };
}

export const registerRoutes = new Elysia()
    .guard({
        headers: FrakClientIdHeaderSchema,
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
                email,
            },
        }) => {
            const registrationResponse =
                AuthContext.services.webAuthN.parseCompressedResponse<PublicKeyCredential>(
                    rawRegistrationResponse
                );

            const verification = await verifyRegistrationResponse({
                response:
                    registrationResponse as unknown as RegistrationResponseJSON,
                expectedChallenge: () => true,
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

            const { credential, credentialDeviceType, credentialBackedUp } =
                verification.registrationInfo;

            const { email: cleanEmail, merchantId: cleanMerchantId } =
                sanitiseInputs(email, merchantId);

            const computedWalletAddress =
                previousWallet ??
                (await AuthContext.services.webAuthN.getWalletAddress({
                    authenticatorId: credential.id,
                    pubKey: publicKey,
                }));

            const { created, document } =
                await AuthContext.repositories.authenticator.createAuthenticator(
                    {
                        _id: id,
                        smartWalletAddress: computedWalletAddress,
                        userAgent,
                        credentialPublicKey: Buffer.from(
                            credential.publicKey
                        ).toString("base64"),
                        counter: credential.counter,
                        credentialDeviceType,
                        credentialBackedUp,
                        publicKey,
                        transports: credential.transports,
                    }
                );

            // Same credential id with a different pubkey is either a real
            // collision or a malicious overwrite attempt — never reuse.
            if (
                !created &&
                (document.publicKey.x !== publicKey.x ||
                    document.publicKey.y !== publicKey.y)
            ) {
                log.warn(
                    {
                        credentialId: id,
                        existingPubkey: document.publicKey,
                        incomingPubkey: publicKey,
                    },
                    "Credential id reused with a different public key"
                );
                return status(409, "Credential id conflict");
            }

            // Resolve the wallet via the current-chain binding when an
            // active row exists (post-merge credentials may point at a
            // different wallet than the deterministic derivation). Falls
            // back to the legacy `authenticators.smart_wallet_address`
            // column for credentials registered before the bindings
            // refactor, and finally to the freshly computed address.
            const existingBinding = !created
                ? await IdentityContext.repositories.walletBinding
                      .getActiveBinding({
                          credentialId: document._id,
                          chainId: currentChainId,
                      })
                      .catch(() => null)
                : null;
            const walletAddress =
                existingBinding?.smartWalletAddress ??
                (created
                    ? computedWalletAddress
                    : (document.smartWalletAddress ?? computedWalletAddress));

            // Seed the initial binding for fresh credentials, and lazy
            // back-fill for legacy ones (when none exists yet on the
            // current chain). Idempotent via the partial unique index.
            if (!existingBinding) {
                try {
                    await IdentityContext.repositories.walletBinding.seedInitialBinding(
                        {
                            credentialId: document._id,
                            chainId: currentChainId,
                            smartWalletAddress: walletAddress,
                        }
                    );
                } catch (error) {
                    log.warn(error, "Unable to seed initial binding");
                }
            }

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
                authenticatorId: document._id,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });

            if (created) {
                await OrchestrationContext.orchestrators.identity.linkWalletToFingerprint(
                    {
                        walletAddress,
                        clientId: headers["x-frak-client-id"],
                        merchantId: cleanMerchantId,
                        email: cleanEmail,
                    }
                );
            }

            return {
                token,
                type: "webauthn",
                address: walletAddress,
                authenticatorId: document._id,
                publicKey: document.publicKey,
                transports: document.transports,
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
                merchantId: t.Optional(t.String()),
                email: t.Optional(t.String()),
            }),
            response: {
                400: t.String(),
                409: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
