/**
 * Check if we are in gcp
 */
export const isGcp = $app?.stage?.startsWith("gcp") ?? false;

/**
 * Check if we are in production
 */
export const isProd = $app?.stage?.endsWith("production") ?? false;

/**
 * The normalized stage name
 */
export const normalizedStageName =
    $app?.stage?.replace("gcp-", "")?.replace("aws-", "") ?? "";