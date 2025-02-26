import { isRunningInProd } from "@frak-labs/app-essentials";

/** This hook manages the environment settings for the application.
 * @returns An object with the following properties:
 * - isDebug: A boolean indicating whether the application is in debug mode.
 * - isProduction: A boolean indicating whether the application is running in production.
 */
export function useEnvironment() {
    return {
        // A boolean indicating whether the application is in debug mode.
        isDebug: process.env.DEBUG === "true",
        // A boolean indicating whether the application is running in production.
        isProduction: isRunningInProd,
    };
}
