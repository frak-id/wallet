import { adminWalletContext, pubSubContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { businessContext } from "../context";
import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";

export const businessOracleContext = new Elysia({
    name: "business-oracle-context",
})
    .use(businessContext)
    .use(adminWalletContext)
    .use(pubSubContext)
    .decorate(({ businessDb, ...decorators }) => ({
        ...decorators,
        businessDb,
        merkleRepository: new MerkleTreeRepository(businessDb),
    }))
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .as("plugin");

export type BusinessOracleContextApp = typeof businessOracleContext;
