import { Elysia } from "elysia";

/**
 * Workaround for elysiajs/elysia#1833 (not merged as of elysia v1.4.28):
 *
 * `status(204)` causes Elysia's Bun adapter to emit
 * `new Response("", { status: 204 })`, which Bun rejects with
 * `Response constructor: Invalid response status code 204` because the HTTP
 * spec forbids any body (even an empty string) on 204 No Content. The
 * upstream fix changes the adapter to emit `new Response(null, set)` for
 * empty-body status codes — until it lands, we intercept the response and
 * substitute a valid null-body Response ourselves.
 *
 * Applied at the root app via `.use(noContentPatch)`. The `as: "global"`
 * scope is required so the hook fires for routes defined on the consuming
 * app — not just the plugin's own (empty) instance.
 *
 * Remove once we upgrade to elysia >= 1.5.
 */
export const noContentPatch = new Elysia({
    name: "noContentPatch",
}).mapResponse({ as: "global" }, ({ set }) => {
    if (set.status === 204) {
        return new Response(null, { status: 204 });
    }
});
