import { getEnv } from "@frak-labs/shared/module/utils/getEnv";

/**
 * Check if we are running locally or not
 */
export const isRunningLocally = !["dev", "prod"].includes(getEnv().STAGE ?? "");

/**
 * Check if we are running in production
 */
export const isRunningInProd = getEnv().STAGE === "prod";
