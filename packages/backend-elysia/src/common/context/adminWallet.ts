import { AdminWalletsRepository } from "@backend-common/repositories";
import { Elysia } from "elysia";

export const adminWalletContext = new Elysia({
    name: "Context.admin-wallet",
}).decorate(
    { as: "append" },
    {
        adminWalletsRepository: new AdminWalletsRepository(),
    }
);
