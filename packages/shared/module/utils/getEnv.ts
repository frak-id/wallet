import type { Env } from "../../types/global";

/**
 * Check if it's running in a browser
 * @returns {boolean}
 */
function isBrowser(): boolean {
    return typeof window !== "undefined";
}

/**
 * Get the right environment, either from the browser or from the process
 * @returns {Env}
 */
export function getEnv(): Env {
    if (isBrowser()) {
        if (typeof window.ENV === "undefined") {
            throw new Error("Environment variables not initialized in browser");
        }
        return window.ENV;
    }

    if (typeof process === "undefined" || typeof process.env === "undefined") {
        throw new Error("Process environment variables not available");
    }

    return process.env;
}
