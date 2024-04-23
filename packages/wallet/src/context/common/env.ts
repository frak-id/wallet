/**
 * Export the current Wallet app url
 */
export const appUrl = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Check if we are running locally or not
 */
export const isRunningLocally = process.env.IS_LOCAL === "true";
