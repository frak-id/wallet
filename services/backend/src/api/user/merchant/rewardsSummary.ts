import { t } from "@backend-utils";
import type { ProofOp, ProofVerification } from "@frak-labs/core-sdk/identity";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { OrchestrationContext } from "../../../orchestration/context";

const FiatAmountsSchema = t.Object({
    eurAmount: t.Number(),
    usdAmount: t.Number(),
    gbpAmount: t.Number(),
});

const RewardsSummaryResponseSchema = t.Object({
    linked: t.Boolean(),
    pending: t.Union([
        t.Object({
            total: FiatAmountsSchema,
            cashback: FiatAmountsSchema,
            fromFriends: FiatAmountsSchema,
            count: t.Number(),
            lockedCount: t.Number(),
            nextUnlockAt: t.Union([t.String(), t.Null()]),
            expiresAt: t.Union([t.String(), t.Null()]),
        }),
        t.Null(),
    ]),
    earned: t.Union([t.Object({ total: FiatAmountsSchema }), t.Null()]),
});

// The envelope does not carry its op: the SDK signs `frak-rewards-v1`, the /install page only holds `frak-install-v1`.
const ACCEPTED_PROOF_OPS: readonly ProofOp[] = [
    "frak-rewards-v1",
    "frak-install-v1",
];

async function isProofAccepted(params: {
    proof: string;
    merchantId: string;
    anonymousId: string;
}): Promise<boolean> {
    const { identityProof } = IdentityContext.services;
    let outcome: { op: ProofOp; result: ProofVerification } | undefined;
    for (const op of ACCEPTED_PROOF_OPS) {
        const result = await identityProof.check({ ...params, op });
        outcome = { op, result };
        if (result.valid) break;
    }
    if (!outcome) return false;
    identityProof.record({ ...params, op: outcome.op }, outcome.result);
    return outcome.result.valid;
}

export const merchantRewardsSummaryRoute = new Elysia().get(
    "/rewards-summary",
    async ({ headers, query, set }) => {
        set.headers["cache-control"] = "private, no-store";

        const anonymousId = headers["x-frak-client-id"];
        const proof = headers["x-frak-proof"];
        const { merchantId } = query;

        if (!anonymousId) {
            return status(400, {
                success: false,
                code: "CLIENT_ID_REQUIRED",
                error: "x-frak-client-id header required",
            });
        }
        if (!proof) {
            return status(403, {
                success: false,
                code: "PROOF_REQUIRED",
                error: "x-frak-proof header required",
            });
        }
        if (!(await isProofAccepted({ proof, merchantId, anonymousId }))) {
            return status(403, {
                success: false,
                code: "PROOF_INVALID",
                error: "Identity proof failed verification",
            });
        }

        return OrchestrationContext.orchestrators.rewardHistory.getMerchantRewardSummary(
            { anonymousId, merchantId }
        );
    },
    {
        headers: t.Partial(
            t.Object({
                "x-frak-client-id": t.String(),
                "x-frak-proof": t.String(),
            })
        ),
        query: t.Object({
            merchantId: t.String({ format: "uuid" }),
        }),
        response: {
            200: RewardsSummaryResponseSchema,
            400: t.ErrorResponse,
            403: t.ErrorResponse,
        },
    }
);
