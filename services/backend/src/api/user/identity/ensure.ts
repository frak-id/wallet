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
        async ({ headers, body, walletSession }) => {
            const { merchantId, anonymousId: bodyAnonymousId } = body;

            // Determine the anonymousId: body (wallet app) or header (SDK)
            const anonymousId = bodyAnonymousId || headers["x-frak-client-id"];

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

            // Resolve and associate — idempotent, cheap when already linked
            const { finalGroupId, merged } =
                await OrchestrationContext.orchestrators.identity.resolveAndAssociate(
                    identityNodes
                );

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
            },
        }
    );
