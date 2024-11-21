import { type RouteConfig, index, route } from "@remix-run/route-config";

export const routes: RouteConfig = [
    index("./views/home.tsx"),
    route("/article", "./views/article.tsx"),
];
