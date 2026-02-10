import { currentStablecoins } from "@frak-labs/app-essentials";
import type { Address } from "viem";

export const migrationConfig = {
    indexerUrl: process.env.INDEXER_URL ?? "https://ponder.gcp.frak.id",
    mongodbUri: process.env.MONGODB_BUSINESS_URI ?? "",
    mongodbDatabase:
        process.env.NODE_ENV === "production" ? "business" : "business-dev",
    defaultRewardToken: currentStablecoins.eure as Address,
    dryRun: process.env.DRY_RUN !== "false",
    logLevel: (process.env.LOG_LEVEL ?? "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",
};

export function validateConfig(): void {
    if (!migrationConfig.indexerUrl) {
        throw new Error("INDEXER_URL is required");
    }
    if (!migrationConfig.mongodbUri && !migrationConfig.dryRun) {
        throw new Error(
            "MONGODB_BUSINESS_URI is required for non-dry-run mode"
        );
    }
}
