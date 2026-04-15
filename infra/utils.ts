/**
 * Check if we are in gcp
 */
export const isGcp = $app?.stage?.startsWith("gcp") ?? false;

/**
 * Check if we are in production
 */
export const isProd =
    $app.stage.includes("production") || $app.stage === "prod";

/**
 * The normalized stage name (strips gcp-, aws- prefix and -v2 suffix)
 */
export const normalizedStageName =
    $app?.stage?.replace("gcp-", "")?.replace("aws-", "")?.replace("-v2", "") ??
    "";
