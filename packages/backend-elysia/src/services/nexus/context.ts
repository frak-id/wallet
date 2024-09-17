import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia, t } from "elysia";
import { unsealData } from "iron-session";
import { Config } from "sst/node/config";
import type { Address } from "viem";
import { blockchainContext, postgresContext } from "../../common/context";
import * as dbSchema from "./db/schema";

export const nexusContext = new Elysia({
    name: "nexus-context",
})
    .use(blockchainContext)
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        nexusDb: drizzle(postgresDb, {
            schema: dbSchema,
        }),
    }));

export type NexusContextApp = typeof nexusContext;

export const authNexusUser = new Elysia({
    name: "nexus-context-authenticated-user",
})
    .use(nexusContext)
    .guard({
        cookie: t.Object({
            nexusSession: t.Optional(t.String()),
        }),
    })
    .resolve(async ({ cookie: { nexusSession } }) => {
        // If we got no session cookie
        if (!nexusSession?.value) {
            return { session: undefined };
        }

        // If we got one, try to decode the cookie and then proceed
        const decodedSession = await unsealData(nexusSession.value, {
            password: Config.SESSION_ENCRYPTION_KEY,
            ttl: 60 * 60 * 24 * 7, // 1 week
        });
        return {
            session: decodedSession as {
                wallet: {
                    address: Address;
                };
            },
        };
    })
    .as("plugin");
export type AuthenticatedNexusContextApp = typeof authNexusUser;
