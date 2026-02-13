/**
 * Check if we are running locally or not
 *  - Don't use include, since simple equal condition are well replaced during build time (and not include)
 *  - STAGE is always normalized by infra (strips gcp-/aws- prefix and -v2 suffix)
 */
const stage = process.env.STAGE;

export const isRunningLocally =
    stage !== "dev" &&
    stage !== "example" &&
    stage !== "prod" &&
    stage !== "production" &&
    stage !== "staging";

/**
 * Check if we are running in production
 */
export const isRunningInProd = stage === "prod" || stage === "production";
