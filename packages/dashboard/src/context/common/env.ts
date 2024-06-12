/**
 * Check if we are running in production
 */
export const isRunningInProd = process.env.STAGE === "prod";
