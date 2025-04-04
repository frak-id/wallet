import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@react-router/dev/routes";

export default [
    // Landing Routes
    index("./views/landings/home.tsx"),

    // Wallet routes
    layout("./views/layouts/wallet.tsx", [
        // Auth Routes
        layout("./views/layouts/authentication.tsx", [
            route("/login", "./views/auth/login.tsx"),
            route("/register", "./views/auth/register.tsx"),
            route("/register/demo", "./views/auth/register-demo.tsx"),
            route("/recovery", "./views/auth/recovery.tsx"),
        ]),

        // SSO Routes
        layout("./views/layouts/sso.tsx", [
            route("/sso", "./views/auth/sso.tsx"),
        ]),

        // Protected Routes
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

    // SDK routes
    layout("./views/layouts/sdk.tsx", [
        // Listener Routes
        route("/listener", "./views/listener.tsx"),
    ]),

    // Catch-all Route
    route("*", "./views/catch-all.tsx"),
] satisfies RouteConfig;
