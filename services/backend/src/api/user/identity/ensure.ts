import {
    log,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity";
import { OrchestrationContext } from "../../../orchestration/context";
import { enforceLatchedProof } from "../../../orchestration/identity/latchedProof";
import { buildIdentityNodes } from "../track/sdkIdentity";

/**
 * Shared latch-gated proof policy (DUAL-ARM-PLAN.md WS-BE-1) — the same
 * function `AnonymousMergeOrchestrator.enforceProof` uses for
 * `/merge/execute` and `/merge/initiate`. `ensure.ts` has no dedicated
 * orchestrator (DECISIONS §2.3), so it calls the shared helper directly
 * rather than going through an orchestrator instance.
 *
 *   1. proof present → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒ allow
 *      (and the caller may now latch).
 *   2. proof absent  → read the node's latch; latched ⇒ 403 PROOF_REQUIRED,
 *      otherwise allow (legacy id, or a derived id never yet proven).
 *
 * Returns whether a valid proof was presented, so the caller only writes
 * the latch when it is actually earned — never on the fail-open path.
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
 * WALLET arm (README §5) — anonymousId comes from the request BODY, or a
 * `ticket`. This is exactly what the installed Tauri binary sends
 * (`{merchantId, anonymousId}`, no ticket, no proof), so it stays exactly
 * as permissive as it is today: a proof, if present, is verified and
 * logged but never required and never rejects the request.
 * ROLLOUT-STEP-3 (blocked on store approval + minVersion): make
 * ticket-or-proof mandatory and delete the bare `anonymousId` fallback. See
 * ROLLOUT.md. Do not touch until then.
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

    // ROLLOUT-STEP-3: this is the legacy bearer arm — a raw id with nothing
    // proving it belongs to the caller. It survives only because the
    // installed Tauri binary POSTs exactly this shape. Delete it, and make
    // ticket-or-proof mandatory, once minVersion excludes those builds
    // (README §5 step 2, "a pure deletion"). See ROLLOUT.md.
    //
    // Unreachable via the router below (it only calls this function when
    // `ticket || bodyAnonymousId`), kept as a defensive guard against future
    // callers.
    if (!bodyAnonymousId) {
        throw HttpError.badRequest(
            "MISSING_ANONYMOUS_ID",
            "anonymousId is required in the wallet arm"
        );
    }

    // Verified inline rather than delegated to an orchestrator: this route
    // already calls `identity.resolveAndAssociate` directly and has no
    // dedicated orchestrator of its own (DECISIONS §2.3 — the one documented
    // exception to "orchestrator owns policy").
    //
    // Verify and record the outcome when a proof is present; never require
    // one, never reject on an invalid one — this arm stays permissive until
    // ROLLOUT-STEP-3.
    //
    // op is `frak-install-v1`, NOT `frak-ensure-v1` (DUAL-ARM-PLAN.md D-B).
    // The wallet holds no signing key (README §2.0, §9 "settled" — it must
    // never get a second P-256 identity key), so it can never produce a
    // `frak-ensure-v1` proof; verifying against that op meant this block was
    // dead code, guaranteed to fail for every proof it would ever see. The
    // only proof this arm can ever receive is the `frak-install-v1` one
    // carried through the `#p=` fragment / Play referrer / pending action
    // (`InstallProcessing`, `useInstallReferrer`), which binds exactly
    // `merchantId` ‖ `anonymousId` with an empty binding — precisely what
    // this arm needs to authenticate.
    //
    // ROLLOUT-STEP-3: today this is redundant with the bare `anonymousId`
    // arm right above, which is open to anyone — accepting the proof can
    // only add evidence, never remove it. Once that bare arm is deleted,
    // `frak-install-v1` becomes a SUFFICIENT ensure credential on its own,
    // and its "high" leak rating (README §2.2 — URL fragment + Play
    // referrer) starts to matter. Revisit then whether it should still be
    // accepted directly or must be exchanged for an install ticket first
    // (`install-code/generate` + `resolve`, `ensure.ts`'s own ticket arm
    // above) before this route accepts it as sufficient on its own.
    if (proof) {
        const result = await IdentityContext.services.identityProof.verify({
            op: "frak-install-v1",
            proof,
            merchantId,
            anonymousId: bodyAnonymousId,
            binding: new Uint8Array(0),
        });
        if (!result.valid) {
            log.info(
                {
                    merchantId,
                    anonymousId: bodyAnonymousId,
                    reason: result.reason,
                },
                "Identity proof present but invalid (verified, not enforced — ROLLOUT-STEP-3)"
            );
        }
    }

    return bodyAnonymousId;
}

/**
 * SDK arm (README §5) — anonymousId comes from the `x-frak-client-id`
 * HEADER, never from the body. Latch-gated (DUAL-ARM-PLAN.md D-A, WS-BE-1),
 * NOT unconditionally mandatory as ROLLOUT-STEP-2 previously had it: every
 * legacy client (no key, can never sign — DECISIONS §3.1 D6 never migrates
 * legacy ids) would otherwise hard-403 on every ensure call and silently
 * lose attribution, forever, on this arm never reaching the Tauri binary.
 * Same policy `enforceProof` gives `/merge/execute`: proof present →
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

    // 🔴 Gated on `proofVerified`, not unconditional: latching an id that
    // never actually proved possession (fail-open branch — legacy id, or a
    // derived id that has simply never signed yet) would be a one-way
    // corruption, permanently locking that id out of ever ensuring again
    // without a key it may not have.
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
 * Routes to the WALLET arm or the SDK arm.
 *
 * The discriminator is the CREDENTIAL, not where the id sits in the
 * request — routing on field placement would let an SDK caller with a
 * LATCHED id dodge its proof requirement (DUAL-ARM-PLAN.md WS-BE-1) just by
 * moving its id into the body.
 *
 * But the test is the ABSENCE of a wallet credential, not the presence of
 * an SDK one. The wallet's shared API client attaches every token it holds
 * to every request, so a logged-in wallet sends `x-wallet-auth` AND
 * `x-wallet-sdk-auth` together; keying off the SDK token alone would route
 * the installed Tauri binary onto the mandatory arm and 403 it. A true SDK
 * caller — merchant page, no wallet session — only ever holds the SDK token.
 *
 * Within the wallet arm, README §5's resolution order still applies:
 * `ticket` → body `anonymousId` → header `anonymousId`.
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
                // An SDK caller is one holding an SDK token and NO wallet
                // token. The wallet sends both at once, so the absence of
                // `x-wallet-auth` is what identifies the SDK — see
                // `resolveEnsureAnonymousId`.
                isSdkCaller:
                    Boolean(
                        headers["x-wallet-sdk-auth"] ??
                            request.headers.get("x-wallet-sdk-auth")
                    ) &&
                    !(
                        headers["x-wallet-auth"] ??
                        request.headers.get("x-wallet-auth")
                    ),
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
                // Proof (README §4.1). Latch-gated on the SDK arm
                // (frak-ensure-v1; DUAL-ARM-PLAN.md WS-BE-1 — required only
                // once this id has ever proven itself, not unconditionally);
                // verified-and-logged (frak-install-v1) but never required
                // on the wallet arm until ROLLOUT-STEP-3. See ROLLOUT.md and
                // DUAL-ARM-PLAN.md.
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
                // PROOF_INVALID on the SDK arm (DUAL-ARM-PLAN.md WS-BE-1).
                403: t.ErrorResponse,
                409: t.ErrorResponse,
            },
        }
    );
