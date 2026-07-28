import { log, rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { MerchantContext } from "../../../domain/merchant/context";

const installCodeGenerateRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/generate",
        async ({ body }) => {
            const { merchantId, anonymousId, proof } = body;

            // Verify and record telemetry when a proof is present, never
            // require one. Reuses IdentityProofService — no second verifier.
            //
            // Stays permissive indefinitely, and NOT for the usual
            // store-gating reason — the install page's code view is gated on
            // `!IS_TAURI`, so the binary never reaches this route. It is
            // reachable with no proof from the wallet's own sharing page,
            // whose install link carries a `clientId` resolved from a URL
            // param or a backend lookup rather than from a keypair that
            // could sign for it (see `apps/wallet/app/routes/sharing.tsx`).
            // That arm has nothing to sign with, so requiring a proof here
            // would break it rather than secure it. The install flow's real
            // protection is the ticket minted by `resolve` below, not this
            // proof.
            if (proof) {
                const proofResult =
                    await IdentityContext.services.identityProof.verify({
                        op: "frak-install-v1",
                        proof,
                        merchantId,
                        anonymousId,
                        binding: new Uint8Array(0),
                    });
                if (!proofResult.valid) {
                    log.info(
                        { merchantId, anonymousId, reason: proofResult.reason },
                        "Install proof present but invalid (Phase 2: logged, not enforced)"
                    );
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
                // frak-install-v1 proof (README §4.4). Phase 2: optional,
                // verified when present, never required.
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
            // of whether `generate` carried a proof (README §5, "Why
            // `resolve` mints the ticket unconditionally").
            //
            // ROLLOUT-STEP-3: `anonymousId` stays in this response for old
            // binaries that ignore `ticket`. Drop it, and the dual-arm
            // handling in /identity/ensure, once minVersion excludes them.
            // See ROLLOUT.md.
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
