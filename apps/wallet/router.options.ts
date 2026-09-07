import type { getConfig } from "@tanstack/router-generator";

/**
 * The options both consumers accept.
 *
 * Based on the generator's parameter because it is the strict one: the vite
 * plugin's is a wide `Partial<{…}>` that swallows a misspelled key silently,
 * while this rejects it with a spelling suggestion.
 *
 * `codeSplittingOptions` is added by hand because it is plugin-only — the
 * generator's zod schema strips it. Keep its shape in step with the plugin;
 * a mismatch surfaces at the `tanstackRouter(...)` call site, not silently.
 */
type RouterGenerationOptions = Parameters<typeof getConfig>[0] & {
    codeSplittingOptions?: {
        splitBehavior: (arg: { routeId: string }) => string[] | undefined;
    };
};

/**
 * TanStack Router generation options, shared by the vite plugin and the
 * standalone `generate:routes` script.
 *
 * Both must agree: the script writes the same `routeTree.gen.ts` the build
 * would, so CI can typecheck without paying for a production build. Keeping
 * one object is what makes that true by construction rather than by comment.
 */

/**
 * Parent routes that only render `<Outlet/>` to host nested children.
 * TanStack's plugin cannot detect this from `routeId` alone; the list is
 * verified by grepping for `<Outlet />` in the route files.
 */
const PURE_OUTLET_PARENT_ROUTES = new Set([
    "/_wallet/_protected/wallet",
    "/_wallet/_protected/profile",
    "/_wallet/_protected/settings",
    "/_wallet/_protected-fullscreen/profile/referral",
    "/_wallet/_protected-fullscreen/profile/recovery",
]);

export const routerGenerationOptions = {
    routesDirectory: "./app/routes",
    generatedRouteTree: "./app/routeTree.gen.ts",
    // Per-route lazy chunks. The `feature-*` groups in `buildChunkGroups`
    // re-coalesce these into one chunk per feature so each navigation is a
    // single fetch.
    autoCodeSplitting: true,
    routeFileIgnorePattern: "\\.css\\.ts$",
    // Per-route splitting policy. Pure-`<Outlet/>` layouts are not split:
    // each would otherwise produce a 200-300 B chunk downloaded eagerly with
    // the child route anyway. Inlining them into the static route tree adds
    // ~1 KB to the entry chunk in exchange for ~10 fewer HTTP requests.
    codeSplittingOptions: {
        splitBehavior: ({ routeId }: { routeId: string }) => {
            // Filename-prefix layouts (TanStack convention).
            const lastSegment = routeId.split("/").pop() ?? "";
            if (lastSegment.startsWith("_")) return [];
            if (PURE_OUTLET_PARENT_ROUTES.has(routeId)) return [];
            // Default: split the component into a lazy chunk.
            return undefined;
        },
    },
} satisfies RouterGenerationOptions;
