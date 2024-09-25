import {
    adminWalletContext,
    blockchainContext,
    cacheContext,
} from "@backend-common";
import { Elysia } from "elysia";

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
