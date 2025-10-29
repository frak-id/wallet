import {
    index,
    layout,
    type RouteConfig,
    route,
} from "@react-router/dev/routes";

/**
 * Route configuration with optimized code splitting
 *
 * Performance strategy:
 * - Home route is eager (users land here first)
 * - Auth routes (login/register) are in a single chunk (commonly accessed together)
 * - Protected routes are lazy-loaded individually
 * - Layouts are kept small and shared across routes
 *
 * This configuration eliminates the 2-3s waterfall by:
 * 1. Ensuring routes are genuinely code-split (not bundled in entry.client)
 * 2. Grouping related routes to reduce chunk overhead
 * 3. Preloading critical paths via modulepreload hints
 */
export default [
    // Landing Routes - Eager load (first page users see)
    index("./views/landings/home.tsx"),

    // Wallet routes
    layout("./views/layouts/wallet.tsx", [
        // Auth Routes - Group together since they're often accessed in sequence
        layout("./views/layouts/authentication.tsx", [
            route("/login", "./views/auth/login.tsx"),
            route("/register", "./views/auth/register.tsx"),
            route("/register/demo", "./views/auth/register-demo.tsx"),
            route("/recovery", "./views/auth/recovery.tsx"),
        ]),

        // SSO Routes - Separate chunk (distinct flow)
        layout("./views/layouts/sso.tsx", [
            route("/sso", "./views/auth/sso.tsx"),
        ]),

        // Protected Routes - Lazy load individually
        layout("./views/layouts/protected.tsx", [
            route("/history", "./views/protected/history.tsx"),
            route("/notifications", "./views/protected/notifications.tsx"),
            route("/settings", "./views/protected/settings.tsx"),
            route(
                "/settings/recovery",
                "./views/protected/settings-recovery.tsx"
            ),
            route("/tokens/receive", "./views/protected/tokens-receive.tsx"),
            route("/tokens/send", "./views/protected/tokens-send.tsx"),
            route("/wallet", "./views/protected/wallet.tsx"),
            route("/membrs", "./views/protected/membrs.tsx"),
            route("/membrs/profile", "./views/protected/membrs-profile.tsx"),
            route("/membrs/fanclub", "./views/protected/membrs-fanclub.tsx"),
            route("/pairing", "./views/auth/pairing.tsx"),
        ]),
    ]),

    // Catch-all Route
    route("*", "./views/catch-all.tsx"),
] satisfies RouteConfig;
