import { infraMetrics, rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import type { InstallCodeCredential } from "../../../domain/identity/repositories/InstallCodeRepository";
import { assertNotMintingServerMintedId } from "../../../domain/identity/schemas/serverMintedId";
import { MerchantContext } from "../../../domain/merchant/context";
import { OrchestrationContext } from "../../../orchestration/context";
import { verifyProofUnenforced } from "../../../orchestration/identity/latchedProof";

async function mintCode(
    merchantId: string,
    credential: InstallCodeCredential
): Promise<{ code: string; expiresAt: string }> {
    const result = await IdentityContext.services.installCode.generate({
        merchantId,
        credential,
    });
    return {
        code: result.code,
        expiresAt: new Date(result.expiresAt).toISOString(),
    };
}

/**
 * Runs the Gate 2 ladder. A miss is deferred rather than fatal: a late or
 * failed webhook must never stop a legitimate buyer getting a code.
 */
async function resolveCheckoutTokenCredential(params: {
    merchantId: string;
    checkoutToken: string;
}): Promise<InstallCodeCredential> {
    const resolution =
        await OrchestrationContext.orchestrators.installCredential.resolveForGenerate(
            params
        );
    if (resolution.outcome === "unresolved") {
        throw HttpError.notFound(
            "MERCHANT_NOT_CONFIGURED",
            "Merchant has no purchase webhook configured"
        );
    }
    return {
        kind: "checkoutToken",
        checkoutToken: params.checkoutToken,
        anonymousId:
            resolution.outcome === "resolved" ? resolution.anonymousId : null,
    };
}

const installCodeGenerateRoute = new Elysia()
    .use(
        rateLimitMiddleware({
            bucket: "identity-install-code-generate",
            windowMs: 60_000,
            maxRequests: 5,
        })
    )
    .post(
        "/generate",
        async ({ body }) => {
            const { merchantId, anonymousId, checkoutToken, proof } = body;

            if (anonymousId && checkoutToken) {
                throw HttpError.badRequest(
                    "AMBIGUOUS_CREDENTIAL",
                    "Present either anonymousId or checkoutToken, not both"
                );
            }

            if (checkoutToken) {
                const credential = await resolveCheckoutTokenCredential({
                    merchantId,
                    checkoutToken,
                });
                return mintCode(merchantId, credential);
            }

            if (!anonymousId) {
                throw HttpError.badRequest(
                    "MISSING_CREDENTIAL",
                    "Either anonymousId or checkoutToken is required"
                );
            }

            await assertNotMintingServerMintedId({
                value: anonymousId,
                merchantId,
                identityRepository: IdentityContext.repositories.identity,
            });

            // Verify when present, never require one: this route is also
            // reachable from the wallet's own sharing page, whose install link
            // has no keypair to sign with. The install flow's real protection
            // is the ticket `resolve` mints below.
            //
            // The code path's later ensure carries a ticket and no proof, so
            // this is its only chance to latch. Gated on success —
            // `markProofSeen` never clears.
            let proofVerified = false;
            if (proof) {
                proofVerified = await verifyProofUnenforced({
                    op: "frak-install-v1",
                    proof,
                    merchantId,
                    anonymousId,
                    identityProofService:
                        IdentityContext.services.identityProof,
                    onClass: (credentialClass) =>
                        infraMetrics.identityInstallCodeGenerateCredential(
                            credentialClass
                        ),
                });
                if (proofVerified) {
                    await IdentityContext.repositories.identity.markProofSeen({
                        type: "anonymous_fingerprint",
                        value: anonymousId,
                        merchantId,
                    });
                }
            } else {
                // This route never reads the latch, so a proofless call for an
                // already-latched id is counted here too: the class overstates
                // "would still work" and understates `absent_latched`.
                infraMetrics.identityInstallCodeGenerateCredential(
                    "absent_unlatched"
                );
            }

            // After the verification above, so the counter observes every
            // request including the ones this refuses. The Gate 2 token arm
            // returned earlier and is never gated — its credential is
            // derived server-side from the order.
            if (!proofVerified) {
                throw proof
                    ? HttpError.forbidden(
                          "PROOF_INVALID",
                          "The supplied proof is not valid for this identity"
                      )
                    : HttpError.forbidden(
                          "PROOF_REQUIRED",
                          "A proof of possession is required to generate an install code"
                      );
            }

            return mintCode(merchantId, { kind: "anonymous", anonymousId });
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.Optional(t.String()),
                // Shopify checkout token: the credential for buyers whose
                // surface holds an order and no keypair.
                checkoutToken: t.Optional(t.String()),
                // frak-install-v1 proof, mandatory on the anonymousId arm.
                // Optional here because the Gate 2 checkoutToken arm carries
                // none, and a required field would 422 it.
                proof: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    code: t.String(),
                    expiresAt: t.String(),
                }),
                400: t.ErrorResponse,
                // PROOF_REQUIRED (none supplied) or PROOF_INVALID (supplied
                // but unverifiable), once the generate flip is enabled.
                403: t.ErrorResponse,
                404: t.ErrorResponse,
            },
        }
    );

/**
 * This route is unauthenticated, so deferred resolution must never be a lookup
 * on caller input. The caller presents a 6-char code; the row it names was
 * bound to `(merchantId, checkoutToken)` by a prior `generate`, and the ladder
 * re-runs on that stored token only. There is no caller-named `anonymousId` to
 * fall back to, and there must never be one.
 */
async function resolveRowAnonymousId(row: {
    merchantId: string;
    anonymousId: string | null;
    checkoutToken: string | null;
}): Promise<string | null> {
    if (row.anonymousId) {
        return row.anonymousId;
    }
    if (!row.checkoutToken) {
        return null;
    }
    const deferred =
        await OrchestrationContext.orchestrators.installCredential.resolveDeferred(
            { merchantId: row.merchantId, checkoutToken: row.checkoutToken }
        );
    return deferred?.anonymousId ?? null;
}

const installCodeResolveRoute = new Elysia()
    .use(
        rateLimitMiddleware({
            bucket: "identity-install-code-resolve",
            windowMs: 60_000,
            maxRequests: 10,
        })
    )
    .post(
        "/resolve",
        async ({ body }) => {
            const installCode =
                await IdentityContext.services.installCode.resolve({
                    code: body.code,
                });
            const { merchantId } = installCode;

            const [merchant, anonymousId] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                resolveRowAnonymousId(installCode),
            ]);

            if (!merchant) {
                throw HttpError.notFound(
                    "MERCHANT_NOT_FOUND",
                    "Merchant not found"
                );
            }
            const merchantInfo = {
                name: merchant.name,
                domain: merchant.domain,
            };

            if (!anonymousId) {
                return {
                    merchantId,
                    merchant: merchantInfo,
                    hasWallet: false,
                    outcome: "UNRESOLVED" as const,
                };
            }

            const identityGroup =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    {
                        type: "anonymous_fingerprint",
                        value: anonymousId,
                        merchantId,
                    }
                );

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
            // ROLLOUT-STEP-3: the current wallet no longer reads `anonymousId`
            // from this response, so only old binaries that ignore `ticket`
            // still need it. Dropping the field is the remaining backend-only
            // deploy, and it must follow the wallet, never lead it.
            const ticket =
                await IdentityContext.services.installCode.mintTicket({
                    merchantId,
                    anonymousId,
                });

            return {
                merchantId,
                anonymousId,
                merchant: merchantInfo,
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
                    anonymousId: t.Optional(t.String()),
                    merchant: t.Object({
                        name: t.String(),
                        domain: t.String(),
                    }),
                    hasWallet: t.Boolean(),
                    // Minted or omitted as a pair with `anonymousId`.
                    ticket: t.Optional(t.String()),
                    outcome: t.Optional(t.Literal("UNRESOLVED")),
                }),
                404: t.ErrorResponse,
            },
        }
    );

export const installCodeRoutes = new Elysia({ prefix: "/install-code" })
    .use(installCodeGenerateRoute)
    .use(installCodeResolveRoute);
