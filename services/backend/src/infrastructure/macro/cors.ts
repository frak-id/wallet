import { cors } from "@elysiajs/cors";
import { AUTH_ERROR_HEADER, AUTH_METHODS_HEADER } from "./authError";

export const corsPlugin = cors({
    methods: ["DELETE", "GET", "POST", "PUT", "PATCH"],
    // The wallet and business clients fetch with `credentials: "include"`;
    // @elysiajs/cors 1.4.3 defaults this to false, which fails every preflight.
    credentials: true,
    // Expose the auth-error discriminator (and, for a step-up 401, the
    // offered-methods list) so cross-origin frontends can read them on a 401.
    exposeHeaders: [AUTH_ERROR_HEADER, AUTH_METHODS_HEADER],
});
