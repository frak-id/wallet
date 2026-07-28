import {
    log,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity";
import { OrchestrationContext } from "../../../orchestration/context";
import { buildIdentityNodes } from "../track/sdkIdentity";

/**
 * Resolves the anonymousId per README §5's order: `ticket` → `proof` +
 * `anonymousId` → bare `anonymousId` (legacy). A ticket already
 * authenticates its own anonymousId, so it short-circuits the rest; an
 * invalid/expired ticket is rejected outright rather than silently
 * downgraded to a weaker arm.
 */
async function resolveEnsureAnonymousId(params: {
    merchantId: string;
    bodyAnonymousId?: string;
    ticket?: string;
    proof?: string;
    headerClientId?: string;
    requestClientId: string | null;
}): Promise<string> {
    const {
        merchantId,
        bodyAnonymousId,
        ticket,
        proof,
        headerClientId,
        requestClientId,
    } = params;

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

    // Determine the anonymousId: body (wallet app) or header (SDK)
    const anonymousId =
        bodyAnonymousId ?? headerClientId ?? requestClientId ?? undefined;
    if (!anonymousId) {
        throw HttpError.badRequest(
            "MISSING_ANONYMOUS_ID",
            "anonymousId must be provided in body or via x-frak-client-id header"
        );
    }

    // Verified inline rather than delegated to an orchestrator: this route
    // already calls `identity.resolveAndAssociate` directly and has no
    // dedicated orchestrator of its own (DECISIONS §2.3 — the one documented
    // exception to "orchestrator owns policy"). Phase 2: verify and
    // log/telemetry the outcome when a proof is present; never require one
    // and never reject on an invalid proof — enforcement is Phase 4a, gated
    // on the §4.6 latch.
    if (proof) {
        const result = await IdentityContext.services.identityProof.verify({
            op: "frak-ensure-v1",
            proof,
            merchantId,
            anonymousId,
            binding: new Uint8Array(0),
        });
        if (!result.valid) {
            log.info(
                { merchantId, anonymousId, reason: result.reason },
                "Identity proof present but invalid (Phase 2: logged, not enforced)"
            );
        }
    }

    return anonymousId;
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
        async ({ headers, body, walletSession, request }) => {
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
            // A hostile actor can have already merged this anonymousId into a
            // group that holds a DIFFERENT wallet than the one authenticating
            // here (README §1, "the consequence that is worse than theft").
            // `resolveAndAssociate` -> `determineAnchorFromMultiple` refuses
            // that merge and throws WALLET_CONFLICT — correctly, but left
            // uncaught the 409 propagates to a caller
            // (`useExecutePendingActions`) that retries it for the full
            // 7-day pending-action TTL with nothing ever surfaced (§3.8).
            // Catch specifically this conflict, log it as a security event,
            // and return a stable, non-retryable error code. Every other
            // error still propagates unchanged.
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
            // A route-local `headers` schema REPLACES the one `sessionContext`
            // declares in its `.guard()`, it does not merge with it — Elysia
            // only exposes headers a route itself declares. Omitting the two
            // auth headers here hides them from `withWalletOrSdkAuthent`'s
            // resolve, which then 401s every request no matter how valid the
            // credential is. Re-declare them alongside the client-id header.
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
                // Install ticket (README §5). Authenticates its own
                // anonymousId — takes priority over `proof`/`anonymousId`.
                ticket: t.Optional(t.String()),
                // frak-ensure-v1 proof (README §4.1). Phase 2: optional,
                // verified when present, never required.
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
                409: t.ErrorResponse,
            },
        }
    );
