import { Elysia } from "elysia";
import { linkRoutes } from "./link";
import { loginRoutes } from "./login";
import { sessionManagementRoutes } from "./sessions";
import { shopifyAuthRoutes } from "./shopify";
import { twoFactorRoutes } from "./twoFactor";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(loginRoutes)
    .use(twoFactorRoutes)
    .use(sessionManagementRoutes)
    .use(linkRoutes)
    .use(shopifyAuthRoutes);
