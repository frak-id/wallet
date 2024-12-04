import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@react-router/dev/routes";

export default [
    // Landing Routes
    index("./views/landings/home.tsx"),

    // Auth Routes
    layout("./views/layouts/authentication.tsx", [
        route("/login", "./views/auth/login.tsx"),
        route("/register", "./views/auth/register.tsx"),
        route("/recovery", "./views/auth/recovery.tsx"),
        route("/fallback", "./views/auth/fallback.tsx"),
    ]),
    layout("./views/layouts/sso.tsx", [route("/sso", "./views/auth/sso.tsx")]),

    // Protected Routes
    layout("./views/layouts/protected.tsx", [
        route("/history", "./views/protected/history.tsx"),
        route("/notifications", "./views/protected/notifications.tsx"),
        route("/settings", "./views/protected/settings.tsx"),
        route("/settings/recovery", "./views/protected/settings-recovery.tsx"),
        route("/tokens/receive", "./views/protected/tokens-receive.tsx"),
        route("/tokens/send", "./views/protected/tokens-send.tsx"),
        route("/wallet", "./views/protected/wallet.tsx"),
    ]),

    // Listener Routes
    route("/listener", "./views/listener.tsx"),

    // Catch-all Route
    route("*", "./views/catch-all.tsx"),
] satisfies RouteConfig;
