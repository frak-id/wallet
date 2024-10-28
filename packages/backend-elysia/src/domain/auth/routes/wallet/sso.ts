import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { compressToBase64 } from "async-lz-string";
import { webAuthNService } from "domain/auth/services/WebAuthNService";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { ssoTable } from "../../db/schema";
import { WalletAuthResponseDto } from "../../models/WalletSessionDto";
import { walletSdkSessionService } from "../../services/WalletSdkSessionService";
import { walletSsoService } from "../../services/WalletSsoService";

export const walletSsoRoutes = new Elysia({
    prefix: "/sso",
})
    // Add the SSO db to the context
    .use(walletSsoService)
    .use(walletSdkSessionService)
    .use(webAuthNService)
    // Route to create a new sso session
    .post(
        "/sso/create",
        async ({ body: { productId, consumeKey, params }, ssoDb }) => {
            // Generate the sso id
            const paramHash = keccak256(toHex(JSON.stringify(params)));
            const ssoId = keccak256(
                concatHex([generatePrivateKey(), paramHash])
            );

            // Save this sso session
            await ssoDb
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
            const compressedParams = await compressToBase64(
                JSON.stringify(finalParams)
            );

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
        "/sso/consume",
        async ({
            body: { id, productId, consumeKey },
            // Response
            error,
            // Context
            getAuthenticatorDb,
            walletJwt,
            generateSdkJwt,
            ssoDb,
        }) => {
            // Get the sso session
            const ssoSessions = await ssoDb
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
                !(
                    ssoSession.resolvedAt &&
                    ssoSession.wallet &&
                    ssoSession.authenticatorId
                )
            ) {
                return { status: "pending" };
            }

            // Get the authenticator db and resolve it
            const authenticatorDb = await getAuthenticatorDb();
            const authenticator = await authenticatorDb.getByCredentialId(
                ssoSession.authenticatorId
            );
            if (!authenticator) {
                return error(404, "Authenticator not found");
            }

            // Remove the sso session
            await ssoDb
                .delete(ssoTable)
                .where(eq(ssoTable.id, ssoSession.id))
                .execute();

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: ssoSession.wallet,
                authenticatorId: authenticator._id,
                publicKey: authenticator.publicKey,
                sub: ssoSession.wallet,
                iat: Date.now(),
            });

            // Finally, generate a JWT token for the SDK
            const sdkJwt = await generateSdkJwt({ wallet: ssoSession.wallet });

            return {
                status: "ok",
                session: {
                    token,
                    address: ssoSession.wallet,
                    authenticatorId: authenticator._id,
                    publicKey: authenticator.publicKey,
                    transports: authenticator.transports,
                    sdkJwt,
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
