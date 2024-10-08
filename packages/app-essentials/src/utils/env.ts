/**
 * Check if we are running locally or not
 */
export const isRunningLocally = !["dev", "prod"].includes(
    process.env.STAGE ?? ""
);

/**
 * Check if we are running in production
 */
export const isRunningInProd = process.env.STAGE === "prod";
