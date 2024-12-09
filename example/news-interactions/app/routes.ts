import { type RouteConfig, index, route } from "@remix-run/route-config";

export default [
    index("./views/home.tsx"),
    route("/article", "./views/article.tsx"),
] satisfies RouteConfig;
