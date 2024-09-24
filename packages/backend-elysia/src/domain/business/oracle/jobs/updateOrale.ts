import cron, { Patterns } from "@elysiajs/cron";
import { isNull } from "drizzle-orm";
import { encodePacked } from "viem";
import type { BusinessDb } from "../../context";
import { purchaseStatusTable } from "../../db/schema";
import type { BusinessOracleContextApp } from "../context";

export function updateMerkleRootJob(app: BusinessOracleContextApp) {
    return app.use(
        cron({
            name: "updateMerkleRoot",
            pattern: Patterns.everyMinutes(2),
            run: async () => {
                // Get the repository we will use
                const productSignerRepository =
                    app.decorator.productSignerRepository;

                const test = app.decorator.businessDb;

                // Perform the logic
                await updateMerkleRoot({
                    productSignerRepository,
                });
            },
        })
    );
}

/**
 * Update all the empty leafs if needed
 */
async function updateEmptyLeafs({ businessDb }: { businessDb: BusinessDb }) {
    // Get all purchase with empty leafs
    const purchases = await businessDb.query.purchaseStatusTable.findMany({
        where: isNull(purchaseStatusTable.leaf),
    });

    // Set of oracle ids updated
    const oracleIds = new Set<number>();

    // For each one of them compute their leafs
    for (const purchase of purchases) {
        // Get the blockchain status
        let blockchainStatus: number;
        switch (purchase.status) {
            case "confirmed":
                blockchainStatus = 1;
                break;
            case "cancelled":
                blockchainStatus = 2;
                break;
            case "refunded":
                blockchainStatus = 3;
                break;
            default:
                blockchainStatus = 0;
                break;
        }

        // Compute the leaf
        const leaf = encodePacked(
            [
                {
                    type: "uint256",
                    name: "purchaseId",
                },
                {
                    type: "uint8",
                    name: "status",
                },
            ],
            [purchase.purchaseId, blockchainStatus]
        );

        // Append the product id to our set
        oracleIds.add(purchase.oracleId);
    }
}
