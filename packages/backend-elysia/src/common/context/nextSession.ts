import { Elysia, t } from "elysia";
import { unsealData } from "iron-session";
import { Config } from "sst/node/config";
import type { Address, Hex } from "viem";

/**
 * Build the common context for the app
 */
export const nextSessionContext = new Elysia({
    name: "Context.nextSession",
})
    .decorate(
        { as: "append" },
        {
            /**
             * Decode a session token from Next.js
             */
            async decodeNextSessionCookie<T>({ token }: { token?: string }) {
                if (!token) return undefined;

                // If we got one, try to decode the cookie and then proceed
                return await unsealData<T>(token, {
                    password: Config.SESSION_ENCRYPTION_KEY,
                    ttl: 60 * 60 * 24 * 7, // 1 week
                });
            },
        }
    )
    // Potential nexus cookie session
    .guard({
        cookie: t.Object({
            businessSession: t.Optional(t.String()),
        }),
    })
    // Resolve the session if provided
    .resolve(
        async ({ cookie: { businessSession }, decodeNextSessionCookie }) => ({
            // Decode the business session if present
            businessSession: await decodeNextSessionCookie<{
                wallet: Address;
                siwe: {
                    message: string;
                    signature: Hex;
                };
            }>({
                token: businessSession.value,
            }),
        })
    )
    // Macro to enforce a session or throw an error
    .macro(({ onBeforeHandle }) => ({
        isAuthenticated(wanted?: "business") {
            if (!wanted) return;

            // If no session present, exit with unauthorized
            return onBeforeHandle(async ({ businessSession, error }) => {
                if (wanted === "business" && !businessSession) {
                    return error(401, "Missing business auth cookie");
                }
            });
        },
    }))
    .as("plugin");
