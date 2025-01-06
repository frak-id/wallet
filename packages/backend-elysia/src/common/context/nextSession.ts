import { Elysia, t } from "elysia";
import { unsealData } from "iron-session";
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
                    password: process.env.SESSION_ENCRYPTION_KEY as string,
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
    .macro({
        nextAuthenticated(wanted?: "business") {
            if (!wanted) return;

            return {
                beforeHandle: async ({
                    cookie: { businessSession },
                    error,
                    decodeNextSessionCookie,
                }) => {
                    // Resolve the session
                    const resolvedSession = await decodeNextSessionCookie<{
                        wallet: Address;
                        siwe: {
                            message: string;
                            signature: Hex;
                        };
                    }>({
                        token: businessSession.value,
                    });

                    // If none is found, throw an error
                    if (
                        wanted === "business" &&
                        !(businessSession && resolvedSession)
                    ) {
                        return error(401, "Missing business auth cookie");
                    }
                },
            };
        },
    })
    .as("plugin");
