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
    }))
    // Potential nexus cookie session
    .guard({
        cookie: t.Object({
            nexusSession: t.Optional(t.String()),
        }),
    })
    // Resolve the session if present
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
    // Macro to enforce nexus authentication if needed
    .macro(({ onBeforeHandle }) => ({
        isNexusAuthenticated(enabled?: boolean) {
            if (!enabled) {
                return;
            }

            // If no session present, exit with unauthorized
            return onBeforeHandle(async ({ session, error }) => {
                if (!session) {
                    return error(401);
                }
            });
        },
    }))
    .as("plugin");
