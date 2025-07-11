import { t } from "@backend-utils";
import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { compressJsonToB64 } from "@frak-labs/core-sdk";
import { and, eq } from "drizzle-orm";
import { Elysia, error } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import {
    type StaticWalletSdkTokenDto,
    type StaticWalletTokenDto,
    WalletAuthResponseDto,
    authContext,
    ssoTable,
} from "../../../../domain/auth";

export const walletSsoRoutes = new Elysia({
    prefix: "/sso",
})
    // Add the SSO db to the context
    .use(authContext)
    // Route to create a new sso session
    .post(
        "/create",
        async ({ body: { productId, consumeKey, params }, auth: { db } }) => {
            // Generate the sso id
            const paramHash = keccak256(toHex(JSON.stringify(params)));
            const ssoId = keccak256(
                concatHex([generatePrivateKey(), paramHash])
            );

            // Save this sso session
            await db
                .insert(ssoTable)
                .values({
                    ssoId,
                    consumeKey,
                    productId,
                })
                .execute();

            // Append the id to the final params
            const finalParams = {
                id: ssoId,
                ...params,
            };
            const compressedParams = compressJsonToB64(finalParams);

            // The final url for the sso
            const url = new URL(
                isRunningInProd
                    ? "https://wallet.frak.id"
                    : isRunningLocally
                      ? "https://localhost:3000"
                      : "https://wallet-dev.frak.id"
            );
            url.pathname = "/sso";
            url.searchParams.append("p", compressedParams);

            return {
                link: url.toString(),
                trackingId: ssoId,
            };
        },
        {
            body: t.Object({
                productId: t.Hex(),
                consumeKey: t.Hex(),
                params: t.Any(),
            }),
            response: {
                200: t.Object({
                    trackingId: t.Hex(),
                    link: t.String(),
                }),
            },
        }
    )
    // Route to consume a current sso session
    .post(
        "/consume",
        async ({
            body: { id, productId, consumeKey },
            // Context
            auth: {
                db,
                services: { walletSdkSession },
                repositories: { authenticator: authenticatorRepository },
            },
            walletJwt,
        }) => {
            // Get the sso session
            const ssoSessions = await db
                .select()
                .from(ssoTable)
                .where(
                    and(
                        eq(ssoTable.ssoId, id),
                        eq(ssoTable.productId, productId)
                    )
                );
            const ssoSession = ssoSessions?.[0];
            if (!ssoSession) {
                return { status: "not-found" };
            }

            // Ensure the consuming key match
            if (BigInt(ssoSession.consumeKey) !== BigInt(consumeKey)) {
                return error(403, "Invalid consume key");
            }

            // If not resolved yet, early exit
            if (
                !ssoSession.resolvedAt ||
                !ssoSession.wallet ||
                !ssoSession.authenticatorId
            ) {
                return { status: "pending" };
            }

            // Get the authenticator db and resolve it
            const authenticator =
                await authenticatorRepository.getByCredentialId(
                    ssoSession.authenticatorId
                );

            // Create our wallet payload
            let walletReference: StaticWalletTokenDto;
            if (authenticator && ssoSession.pairingId) {
                walletReference = {
                    type: "distant-webauthn",
                    address: ssoSession.wallet,
                    authenticatorId: authenticator._id,
                    publicKey: authenticator.publicKey,
                    pairingId: ssoSession.pairingId,
                    transports: undefined,
                };
            } else if (authenticator) {
                walletReference = {
                    type: "webauthn",
                    address: ssoSession.wallet,
                    authenticatorId: authenticator._id,
                    publicKey: authenticator.publicKey,
                    transports: authenticator.transports,
                };
            } else {
                const authenticatorId = `ecdsa-${ssoSession.wallet}` as const;
                walletReference = {
                    type: "ecdsa",
                    address: ssoSession.wallet,
                    authenticatorId: authenticatorId,
                    publicKey: ssoSession.wallet,
                    transports: undefined,
                };
            }

            // Remove the sso session
            await db
                .delete(ssoTable)
                .where(eq(ssoTable.id, ssoSession.id))
                .execute();

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                ...walletReference,
                sub: ssoSession.wallet,
                iat: Date.now(),
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await walletSdkSession.generateSdkJwt({
                wallet: ssoSession.wallet,
                additionalData: ssoSession.sdkTokenAdditionalData as
                    | StaticWalletSdkTokenDto["additionalData"]
                    | undefined,
            });

            // And delete the sso session
            await db.delete(ssoTable).where(eq(ssoTable.ssoId, id)).execute();

            return {
                status: "ok",
                session: {
                    token,
                    sdkJwt,
                    ...walletReference,
                },
            };
        },
        {
            body: t.Object({
                id: t.Hex(),
                productId: t.Hex(),
                consumeKey: t.Hex(),
            }),
            response: {
                403: t.String(),
                404: t.String(),
                200: t.Union([
                    t.Object({
                        status: t.Literal("not-found"),
                    }),
                    t.Object({
                        status: t.Literal("pending"),
                    }),
                    t.Object({
                        status: t.Literal("ok"),
                        session: WalletAuthResponseDto,
                    }),
                ]),
            },
        }
    );
