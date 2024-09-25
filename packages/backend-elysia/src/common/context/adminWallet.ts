import { AdminWalletsRepository } from "@backend-common/repositories";
import Elysia from "elysia";
import { cacheContext } from "./cache";

export const adminWalletContext = new Elysia({
    name: "admin-wallet-context",
})
    .use(cacheContext)
    .decorate(({ cache, ...decorators }) => ({
        ...decorators,
        cache,
        adminWalletsRepository: new AdminWalletsRepository(cache),
    }));
export type AdminWalletContextApp = typeof adminWalletContext;
