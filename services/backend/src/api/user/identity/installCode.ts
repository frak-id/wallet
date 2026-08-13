import { rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { MerchantContext } from "../../../domain/merchant/context";
import { verifyProofUnenforced } from "../../../orchestration/identity/latchedProof";

const installCodeGenerateRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/generate",
        async ({ body }) => {
            const { merchantId, anonymousId, proof } = body;

            // Verify when present, never require one: this route is also
            // reachable from the wallet's own sharing page, whose install link
            // has no keypair to sign with. The install flow's real protection
            // is the ticket `resolve` mints below.
            //
            // The code path's later ensure carries a ticket and no proof, so
            // this is its only chance to latch. Gated on success —
            // `markProofSeen` never clears.
            if (proof) {
                const proofVerified = await verifyProofUnenforced({
                    op: "frak-install-v1",
                    proof,
                    merchantId,
                    anonymousId,
                    identityProofService:
                        IdentityContext.services.identityProof,
                });
                if (proofVerified) {
                    await IdentityContext.repositories.identity.markProofSeen({
                        type: "anonymous_fingerprint",
                        value: anonymousId,
                        merchantId,
                    });
                }
            }

            const result = await IdentityContext.services.installCode.generate({
                merchantId,
                anonymousId,
            });
            return {
                code: result.code,
                expiresAt: new Date(result.expiresAt).toISOString(),
            };
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.String(),
                // frak-install-v1 proof: optional, verified when present,
                // never required.
                proof: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    code: t.String(),
                    expiresAt: t.String(),
                }),
            },
        }
    );

const installCodeResolveRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/resolve",
        async ({ body }) => {
            const { merchantId, anonymousId } =
                await IdentityContext.services.installCode.resolve({
                    code: body.code,
                });

            const [merchant, identityGroup] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                IdentityContext.repositories.identity.findGroupByIdentity({
                    type: "anonymous_fingerprint",
                    value: anonymousId,
                    merchantId,
                }),
            ]);

            if (!merchant) {
                throw HttpError.notFound(
                    "MERCHANT_NOT_FOUND",
                    "Merchant not found"
                );
            }

            let hasWallet = false;
            if (identityGroup) {
                const wallet =
                    await IdentityContext.repositories.identity.getWalletForGroup(
                        identityGroup.id
                    );
                hasWallet = wallet !== null;
            }

            // Minted unconditionally from the row's anonymousId, regardless
            // of whether `generate` carried a proof.
            //
            // ROLLOUT-STEP-3: `anonymousId` stays in this response for old
            // binaries that ignore `ticket`. Drop it, and the dual-arm
            // handling in /identity/ensure, once minVersion excludes them.
            const ticket =
                await IdentityContext.services.installCode.mintTicket({
                    merchantId,
                    anonymousId,
                });

            return {
                merchantId,
                anonymousId,
                merchant: {
                    name: merchant.name,
                    domain: merchant.domain,
                },
                hasWallet,
                ticket,
            };
        },
        {
            body: t.Object({
                code: t.String(),
            }),
            response: {
                200: t.Object({
                    merchantId: t.String(),
                    anonymousId: t.String(),
                    merchant: t.Object({
                        name: t.String(),
                        domain: t.String(),
                    }),
                    hasWallet: t.Boolean(),
                    ticket: t.String(),
                }),
                404: t.ErrorResponse,
            },
        }
    );

export const installCodeRoutes = new Elysia({ prefix: "/install-code" })
    .use(installCodeGenerateRoute)
    .use(installCodeResolveRoute);
