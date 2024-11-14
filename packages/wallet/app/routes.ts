import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@remix-run/route-config";

export const routes: RouteConfig = [
    index("pages/home/route.tsx"),
    layout("pages/authentication/layout.tsx", [
        route("/login", "pages/authentication/login.tsx"),
        route("/recovery", "pages/authentication/recovery.tsx"),
        route("/register", "pages/authentication/register.tsx"),
    ]),
    layout("pages/protected/layout.tsx", [
        route("/history", "pages/protected/history.tsx"),
        route("/notifications", "pages/protected/notifications.tsx"),
        route("/settings", "pages/protected/settings.tsx"),
        route("/settings/recovery", "pages/protected/settings-recovery.tsx"),
        route("/tokens/receive", "pages/protected/tokens-receive.tsx"),
        route("/tokens/send", "pages/protected/tokens-send.tsx"),
        route("/wallet", "pages/protected/wallet.tsx"),
    ]),
    route("/listener", "pages/listener.tsx"),
    route("/sso", "pages/sso.tsx"),
];
