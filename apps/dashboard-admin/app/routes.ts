import {
    index,
    layout,
    type RouteConfig,
    route,
} from "@react-router/dev/routes";

export default [
    // Top level routes
    layout("views/layouts/sidebar.tsx", [
        // Dashboard routes
        index("views/products/index.tsx"),
        route("members", "views/members.tsx"),
        route("campaigns", "views/campaigns.tsx"),
        route("health", "views/health.tsx"),
        // Product detail page
        route("product/:id", "views/products/id.tsx"),
    ]),
] satisfies RouteConfig;
