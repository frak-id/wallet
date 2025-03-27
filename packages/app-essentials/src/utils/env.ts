/**
 * Check if we are running locally or not
 *  - Don't use include, since simple equal condition are well replaced during build time (and not include)
 */
export const isRunningLocally =
    process.env.STAGE !== "dev" &&
    process.env.STAGE !== "prod" &&
    process.env.STAGE !== "staging";

/**
 * Check if we are running in production
 */
export const isRunningInProd = process.env.STAGE === "prod";
