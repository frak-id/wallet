import { AdminWalletsRepository } from "@backend-common/repositories";
import { Elysia } from "elysia";

export const adminWalletContext = new Elysia({
    name: "admin-wallet-context",
}).decorate(
    { as: "append" },
    {
        adminWalletsRepository: new AdminWalletsRepository(),
    }
);
export type AdminWalletContextApp = typeof adminWalletContext;
