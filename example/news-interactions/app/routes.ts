import { type RouteConfig, index, route } from "@remix-run/route-config";

export const routes: RouteConfig = [
    index("pages/home/route.tsx"),
    route("/article", "pages/article/route.tsx"),
];
