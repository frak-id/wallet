import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("./views/home.tsx"),
    route("/article", "./views/article.tsx"),
] satisfies RouteConfig;
