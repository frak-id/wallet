import os from "node:os";

/**
 * Check if we are in gcp
 */
export const isGcp = $app?.stage?.startsWith("gcp") ?? false;

/**
 * Check if we are in production
 */
export const isProd =
    ($app.stage.endsWith("production") ?? false) || $app.stage === "prod";

/**
 * The normalized stage name
 */
export const normalizedStageName =
    $app?.stage?.replace("gcp-", "")?.replace("aws-", "") ?? "";

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
