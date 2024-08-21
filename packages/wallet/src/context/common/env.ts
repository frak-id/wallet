/**
 * Export the current Wallet app url
 */
export const appUrl = process.env.APP_URL ?? "https://localhost:3000";

/**
 * Check if we are running locally or not
 */
export const isRunningLocally = !["dev", "prod" /*, "rodolphe"*/].includes(
    process.env.STAGE ?? ""
);

/**
 * Check if we are running in production
 */
export const isRunningInProd = process.env.STAGE === "prod";
