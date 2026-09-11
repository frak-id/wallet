import { Elysia } from "elysia";

/**
 * Workaround for elysiajs/elysia#1833: `status(204)` makes Elysia's Bun
 * adapter emit `new Response("", …)`, which Bun rejects since 204 forbids any
 * body. `as: "global"` is required so the hook fires for the consuming app's
 * routes, not just this plugin's own instance.
 */
export const noContentPatch = new Elysia({
    name: "noContentPatch",
}).mapResponse({ as: "global" }, ({ set }) => {
    if (set.status === 204) {
        return new Response(null, { status: 204 });
    }
});
