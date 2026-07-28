import {
    log,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import { buildIdentityNodes } from "../track/sdkIdentity";

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
            const { merchantId, anonymousId: bodyAnonymousId } = body;

            // Determine the anonymousId: body (wallet app) or header (SDK)
            const anonymousId =
                bodyAnonymousId ??
                headers["x-frak-client-id"] ??
                request.headers.get("x-frak-client-id");

            if (!anonymousId) {
                throw HttpError.badRequest(
                    "MISSING_ANONYMOUS_ID",
                    "anonymousId must be provided in body or via x-frak-client-id header"
                );
            }

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
            headers: t.Partial(
                t.Object({
                    "x-frak-client-id": t.String(),
                })
            ),
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.Optional(t.String()),
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
