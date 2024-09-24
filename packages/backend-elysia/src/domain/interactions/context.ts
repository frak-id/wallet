import { Elysia } from "elysia";
import {
    adminWalletContext,
    blockchainContext,
    cacheContext,
} from "../../common/context";

/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({ name: "interactions-context" })
    .use(cacheContext)
    .use(blockchainContext)
    .use(adminWalletContext)
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;
