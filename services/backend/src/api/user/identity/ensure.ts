import {
    log,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    enforceLatchedProof,
    verifyProofUnenforced,
} from "../../../orchestration/identity/latchedProof";
import { buildIdentityNodes } from "../track/sdkIdentity";

/**
 * Shared latch-gated proof policy, also used by merge initiate/execute:
 * proof present → verify (invalid ⇒ 403 PROOF_INVALID); proof absent →
 * allow unless the id's latch is set (⇒ 403 PROOF_REQUIRED). Returns
 * whether a valid proof was presented, so the caller only latches when
 * proof was actually earned.
 */
async function enforceEnsureProof(params: {
    anonymousId: string;
    merchantId: string;
    proof?: string;
    op: "frak-ensure-v1" | "frak-install-v1";
    context: string;
}): Promise<boolean> {
    return enforceLatchedProof({
        ...params,
        binding: new Uint8Array(0),
        identityProofService: IdentityContext.services.identityProof,
        identityRepository: IdentityContext.repositories.identity,
    });
}

/**
 * Wallet arm — the anonymousId comes from the body or a ticket. Stays
 * permissive because the installed binary sends neither ticket nor proof: a
 * proof is verified and logged when present, never required.
 *
 * ROLLOUT-STEP-3: make ticket-or-proof mandatory once minVersion excludes
 * those binaries.
 */
async function resolveWalletEnsureAnonymousId(params: {
    merchantId: string;
    bodyAnonymousId?: string;
    ticket?: string;
    proof?: string;
}): Promise<string> {
    const { merchantId, bodyAnonymousId, ticket, proof } = params;

    if (ticket) {
        const resolved =
            await IdentityContext.services.installCode.verifyTicket(ticket);
        if (!resolved) {
            throw HttpError.badRequest(
                "INVALID_TICKET",
                "Install ticket is invalid or expired"
            );
        }
        if (resolved.merchantId !== merchantId) {
            throw HttpError.badRequest(
                "MERCHANT_MISMATCH",
                "Ticket merchant does not match request"
            );
        }
        if (bodyAnonymousId && bodyAnonymousId !== resolved.anonymousId) {
            throw HttpError.badRequest(
                "ANONYMOUS_ID_MISMATCH",
                "Ticket does not match provided anonymousId"
            );
        }
        return resolved.anonymousId;
    }

    // ROLLOUT-STEP-3: legacy bearer arm — a raw id with nothing proving it
    // belongs to the caller, kept only because the installed Tauri binary
    // POSTs exactly this shape.
    //
    // Unreachable today (only called when `ticket || bodyAnonymousId`);
    // kept as a defensive guard.
    if (!bodyAnonymousId) {
        throw HttpError.badRequest(
            "MISSING_ANONYMOUS_ID",
            "anonymousId is required in the wallet arm"
        );
    }

    // op is `frak-install-v1`, not `frak-ensure-v1`: the wallet holds no
    // signing key, so it can never produce an ensure proof. This is the
    // install-v1 proof carried via the `#p=` fragment / Play referrer /
    // pending action, binding merchantId+anonymousId with an empty binding.
    // Verified when present, never required.
    //
    // Latched on success: this is where the deep-link and Play-referrer
    // installs prove themselves, since both reach ensure directly and never
    // touch `install-code/generate` (see `apps/wallet/app/routes/install.tsx`).
    //
    // ROLLOUT-STEP-3: once the bare `anonymousId` arm above is deleted,
    // this proof becomes a SUFFICIENT credential and its leak surface (URL
    // fragment, Play referrer) starts to matter — revisit whether it should
    // still be accepted directly or must be exchanged for an install ticket.
    if (proof) {
        const proofVerified = await verifyProofUnenforced({
            op: "frak-install-v1",
            proof,
            merchantId,
            anonymousId: bodyAnonymousId,
            identityProofService: IdentityContext.services.identityProof,
        });
        if (proofVerified) {
            await IdentityContext.repositories.identity.markProofSeen({
                type: "anonymous_fingerprint",
                value: bodyAnonymousId,
                merchantId,
            });
        }
    }

    return bodyAnonymousId;
}

/**
 * SDK arm — anonymousId comes from the `x-frak-client-id` header, never the
 * body. Latch-gated, not unconditionally mandatory: legacy clients with no
 * key can never sign, so a hard requirement would silently lose their
 * attribution forever. Same policy as `/merge/execute`: proof present →
 * verify; proof absent → allow unless this id has ever latched.
 */
async function resolveSdkEnsureAnonymousId(params: {
    merchantId: string;
    anonymousId: string;
    proof?: string;
}): Promise<string> {
    const { merchantId, anonymousId, proof } = params;

    const proofVerified = await enforceEnsureProof({
        anonymousId,
        merchantId,
        proof,
        op: "frak-ensure-v1",
        context: "ensure SDK arm",
    });

    // Gated on `proofVerified`: latching an id that never actually proved
    // possession would be a one-way corruption, permanently locking it out
    // of ensuring again without a key it may not have.
    if (proofVerified) {
        await IdentityContext.repositories.identity.markProofSeen({
            type: "anonymous_fingerprint",
            value: anonymousId,
            merchantId,
        });
    }

    return anonymousId;
}

/**
 * Routes to the WALLET or SDK arm by which credential VERIFIED
 * (`walletSessionKind`), never by raw header presence — deriving it from
 * headers would let an SDK caller with a valid SDK token plus a garbage
 * wallet token look like a wallet caller and bypass the latch.
 *
 * Within the wallet arm: `ticket` → body `anonymousId` → header `anonymousId`.
 */
async function resolveEnsureAnonymousId(params: {
    merchantId: string;
    bodyAnonymousId?: string;
    ticket?: string;
    proof?: string;
    headerClientId?: string;
    requestClientId: string | null;
    isSdkCaller: boolean;
}): Promise<string> {
    const {
        merchantId,
        bodyAnonymousId,
        ticket,
        proof,
        headerClientId,
        requestClientId,
        isSdkCaller,
    } = params;

    if (isSdkCaller) {
        const anonymousId =
            headerClientId ?? requestClientId ?? bodyAnonymousId ?? undefined;
        if (!anonymousId) {
            throw HttpError.badRequest(
                "MISSING_ANONYMOUS_ID",
                "anonymousId must be provided in body or via x-frak-client-id header"
            );
        }
        return resolveSdkEnsureAnonymousId({
            merchantId,
            anonymousId,
            proof,
        });
    }

    if (ticket || bodyAnonymousId) {
        return resolveWalletEnsureAnonymousId({
            merchantId,
            bodyAnonymousId,
            ticket,
            proof,
        });
    }

    const anonymousId = headerClientId ?? requestClientId ?? undefined;
    if (!anonymousId) {
        throw HttpError.badRequest(
            "MISSING_ANONYMOUS_ID",
            "anonymousId must be provided in body or via x-frak-client-id header"
        );
    }

    return resolveWalletEnsureAnonymousId({
        merchantId,
        bodyAnonymousId: anonymousId,
        ticket,
        proof,
    });
}

/**
 * Failsafe endpoint to ensure a wallet ↔ anonymousId link exists.
 *
 * Supports two authentication paths:
 *   1. Wallet session auth (x-wallet-auth header) — used by the wallet app
 *      when opening from a deep link or consuming an install code.
 *      Requires `anonymousId` in the request body.
 *   2. SDK auth (x-wallet-sdk-auth header) — used by the SDK on merchant
 *      websites. Uses `x-frak-client-id` header as the anonymousId.
 *
 * Uses `resolveAndAssociate()` which is idempotent — if the link already
 * exists, it returns immediately with no DB writes.
 */
export const identityEnsureRoutes = new Elysia({ prefix: "/ensure" })
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "",
        async ({
            headers,
            body,
            walletSession,
            walletSessionKind,
            request,
        }) => {
            const {
                merchantId,
                anonymousId: bodyAnonymousId,
                ticket,
                proof,
            } = body;

            const anonymousId = await resolveEnsureAnonymousId({
                merchantId,
                bodyAnonymousId,
                ticket,
                proof,
                headerClientId: headers["x-frak-client-id"],
                requestClientId: request.headers.get("x-frak-client-id"),
                // The credential that actually verified, not the headers that
                // were merely sent — see `resolveEnsureAnonymousId`.
                isSdkCaller: walletSessionKind === "sdk",
            });

            // Build identity nodes for both wallet and anonymous fingerprint
            const identityNodes = buildIdentityNodes({
                walletAddress: walletSession.address,
                clientId: anonymousId,
                merchantId,
            });

            if (identityNodes.length < 2) {
                throw HttpError.badRequest(
                    "INCOMPLETE_IDENTITY",
                    "Could not build both identity nodes"
                );
            }

            // Resolve and associate — idempotent, cheap when already linked.
            //
            // A hostile actor may have already merged this anonymousId into
            // a group with a DIFFERENT wallet. `resolveAndAssociate` refuses
            // that and throws WALLET_CONFLICT; left uncaught, the 409 would
            // get retried by the caller for the full pending-action TTL with
            // nothing surfaced. Catch it, log as a security event, and
            // return a stable, non-retryable error code.
            let finalGroupId: string;
            let merged: boolean;
            try {
                ({ finalGroupId, merged } =
                    await OrchestrationContext.orchestrators.identity.resolveAndAssociate(
                        identityNodes
                    ));
            } catch (err) {
                if (
                    err instanceof HttpError &&
                    err.code === "WALLET_CONFLICT"
                ) {
                    log.warn(
                        {
                            walletAddress: walletSession.address,
                            anonymousId,
                            merchantId,
                        },
                        "Identity ensure: refused to merge groups linked to different wallets"
                    );
                    throw HttpError.conflict(
                        "WALLET_ALREADY_LINKED",
                        "This anonymous identity is already linked to a different wallet and cannot be merged"
                    );
                }
                throw err;
            }

            if (merged) {
                log.info(
                    {
                        walletAddress: walletSession.address,
                        anonymousId,
                        merchantId,
                        finalGroupId,
                    },
                    "Identity ensure: merged wallet with anonymous identity"
                );
            }

            return {
                status: merged
                    ? ("linked" as const)
                    : ("already_linked" as const),
            };
        },
        {
            withWalletOrSdkAuthent: true,
            // A route-local `headers` schema REPLACES sessionContext's, it
            // doesn't merge — omitting the auth headers here would hide them
            // from `withWalletOrSdkAuthent` and 401 every request. Re-declare
            // them alongside the client-id header.
            headers: t.Partial(
                t.Object({
                    "x-frak-client-id": t.String(),
                    "x-wallet-auth": t.String(),
                    "x-wallet-sdk-auth": t.String(),
                })
            ),
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.Optional(t.String()),
                // Install ticket. Authenticates its own anonymousId —
                // takes priority over `proof`/`anonymousId`.
                ticket: t.Optional(t.String()),
                // Latch-gated on the SDK arm (frak-ensure-v1); verified and
                // logged but never required on the wallet arm until
                // ROLLOUT-STEP-3.
                proof: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    status: t.Union([
                        t.Literal("linked"),
                        t.Literal("already_linked"),
                    ]),
                }),
                400: t.ErrorResponse,
                401: t.String(),
                // PROOF_REQUIRED (latched id, no/invalid proof) or
                // PROOF_INVALID.
                403: t.ErrorResponse,
                409: t.ErrorResponse,
            },
        }
    );
