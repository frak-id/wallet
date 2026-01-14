import os from "node:os";

/**
 * Check if we are in gcp
 */
export const isGcp = $app?.stage?.startsWith("gcp") ?? false;

/**
 * Check if we are in v2 environment
 */
export const isV2 = $app?.stage?.endsWith("-v2") ?? false;

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

/**
 * Get the local IP address for mobile development
 * Returns the first non-internal IPv4 address found
 */
export function getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;

        for (const alias of iface) {
            if (alias.family === "IPv4" && !alias.internal) {
                return alias.address;
            }
        }
    }
    return "localhost";
}
