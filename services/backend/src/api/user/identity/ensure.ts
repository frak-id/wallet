import { log, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    buildIdentityNodes,
    resolveWalletAddress,
    sdkIdentityHeaderSchema,
} from "../track/sdkIdentity";

/**
 * Failsafe endpoint to ensure a wallet ↔ clientId link exists.
 *
 * Called by the SDK on merchant websites after wallet connection is detected.
 * Uses `resolveAndAssociate()` which is idempotent — if the link already
 * exists, it returns immediately with no DB writes.
 *
 * Required headers:
 *   - x-wallet-sdk-auth: SDK JWT (interactionToken from wallet status)
 *   - x-frak-client-id: Anonymous client identifier
 *
 * Required body:
 *   - merchantId: UUID of the merchant
 */
export const identityEnsureRoutes = new Elysia({ prefix: "/ensure" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "",
        async ({ headers, body }) => {
            const walletSdkAuth = headers["x-wallet-sdk-auth"];
            const clientId = headers["x-frak-client-id"];
            const { merchantId } = body;

            // Both identifiers are required for an ensure call
            if (!walletSdkAuth || !clientId) {
                return status(400, {
                    success: false as const,
                    error: "Both x-wallet-sdk-auth and x-frak-client-id headers are required",
                    code: "MISSING_IDENTITY",
                });
            }

            // Resolve the wallet address from the SDK JWT
            const walletAddress = await resolveWalletAddress(walletSdkAuth);
            if (!walletAddress) {
                return status(401, {
                    success: false as const,
                    error: "Invalid or expired SDK JWT",
                    code: "INVALID_TOKEN",
                });
            }

            // Build identity nodes for both wallet and anonymous fingerprint
            const identityNodes = buildIdentityNodes({
                walletAddress,
                clientId,
                merchantId,
            });

            if (identityNodes.length < 2) {
                return status(400, {
                    success: false as const,
                    error: "Could not build both identity nodes",
                    code: "INCOMPLETE_IDENTITY",
                });
            }

            // Resolve and associate — idempotent, cheap when already linked
            const { finalGroupId, merged } =
                await OrchestrationContext.orchestrators.identity.resolveAndAssociate(
                    identityNodes
                );

            if (merged) {
                log.info(
                    {
                        walletAddress,
                        clientId,
                        merchantId,
                        finalGroupId,
                    },
                    "Identity ensure: merged wallet with anonymous identity (failsafe triggered)"
                );
            }

            return {
                status: merged
                    ? ("linked" as const)
                    : ("already_linked" as const),
            };
        },
        {
            headers: sdkIdentityHeaderSchema,
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Object({
                    status: t.Union([
                        t.Literal("linked"),
                        t.Literal("already_linked"),
                    ]),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
            },
        }
    );
