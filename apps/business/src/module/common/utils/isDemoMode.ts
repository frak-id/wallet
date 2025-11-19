/**
 * Server-side utility to check if demo mode is active
 *
 * DEPRECATED: This function is no longer needed.
 * Demo mode is now passed via authMiddleware context.
 *
 * Server functions should check context.isDemoMode instead:
 *
 * @example
 * export const myServerFn = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *         const { isDemoMode } = context;
 *         if (isDemoMode) {
 *             return getDemoData();
 *         }
 *         // ... real data logic
 *     });
 */
export async function isDemoModeActive(): Promise<boolean> {
    // This function is deprecated but kept for backward compatibility
    // Always return false to force usage of context-based demo mode
    return false;
}
