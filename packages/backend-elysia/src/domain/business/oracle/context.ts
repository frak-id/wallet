import Elysia from "elysia";
import { t } from "../../../common";
import { adminWalletContext } from "../../../common/context";
import { businessContext } from "../context";
import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";

export const businessOracleContext = new Elysia({
    name: "business-oracle-context",
})
    .use(businessContext)
    .use(adminWalletContext)
    .decorate(({ cache, businessDb, ...decorators }) => ({
        ...decorators,
        cache,
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
