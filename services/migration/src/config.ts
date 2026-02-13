import { currentStablecoins } from "@frak-labs/app-essentials";
import type { Address } from "viem";

export const migrationConfig = {
    indexerUrl: process.env.INDEXER_URL ?? "https://ponder.gcp.frak.id",
    mongodbUri: process.env.MONGODB_BUSINESS_URI ?? "",
    mongodbDatabase: process.env.MONGO_DATABASE ?? "business",
    defaultRewardToken: currentStablecoins.eure as Address,
    dryRun: process.env.DRY_RUN !== "false",
    logLevel: (process.env.LOG_LEVEL ?? "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",

    excludedProductDomains: [
        "*.frak.id",
        "*.myshopify.com",
        "*.news-paper.xyz",
        "news-paper.xyz",
        "*.basileboli.com",
        "*.sorosorcerer.com",
        "*.nivelais.com",
        "localhost:*",
        "localhost",
    ],

    skippedTriggerKeys: [
        "openArticle",
        "readArticle",
        "proofVerifiableStorageUpdate",
        "callableVerifiableStorageUpdate",
        "unsafeCompleted",
        "customerMeeting",
    ] as string[],
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
