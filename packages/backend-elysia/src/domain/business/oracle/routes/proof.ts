import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { businessOracleContext } from "../context";
import type { UpdateMerkleRootAppJob } from "../jobs/updateOrale";
import { PurchaseProofService } from "../services/proofService";

export const proofRoutes = new Elysia({
    prefix: "/proof",
})
    .use(businessOracleContext)
    .use(PurchaseProofService)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
            purchaseId: t.Optional(t.String()),
        }),
    })
    .resolve(({ params: { productId, purchaseId }, error }) => {
        if (!productId) {
            return error(400, "Invalid product id");
        }
        if (!purchaseId) {
            return error(400, "Invalid purchase id");
        }

        return { productId, purchaseId };
    })
    // Get the proof around a given product and purchase
    .get(
        ":productId/purchase/:purchaseId",
        async ({ productId, purchaseId, store, error, getPurchaseProof }) => {
            // Get the purchase proof
            const result = await getPurchaseProof({ productId, purchaseId });
            if (result.status === "purchase-not-found") {
                return error(404, "Purchase not found");
            }
            if (result.status === "purchase-not-processed") {
                await (
                    store as UpdateMerkleRootAppJob["store"]
                ).cron.updateMerkleRoot.trigger();
                return error(423, "Purchase not processed yet");
            }
            if (result.status === "no-proof-found") {
                return error(404, "No proof found");
            }
            if (result.status === "oracle-not-synced") {
                return error(423, "Oracle not synced");
            }

            return {
                proof: result.proof,
            };
        },
        {
            response: {
                200: t.Object({
                    proof: t.Array(t.Hex()),
                }),
                404: t.String(),
                423: t.String(),
            },
        }
    );
