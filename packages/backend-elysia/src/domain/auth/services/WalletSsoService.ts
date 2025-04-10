import { log, postgresContext, sessionContext } from "@backend-common";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import type { Address, Hex } from "viem";
import { ssoTable } from "../db/schema";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";

export const walletSsoService = new Elysia({
    name: "Service.walletSso",
})
    // Add the SSO db to the context
    .use(postgresContext)
    .use(sessionContext)
    .decorate(({ postgresDb, ...decorators }) => {
        // Get our SSO database
        const db = drizzle({
            client: postgresDb,
            schema: { ssoTable },
        });

        // Helper to resolve a sso session
        async function resolveSession({
            id,
            wallet,
            authenticatorId,
            additionalData,
            pairingId,
        }: {
            id: Hex;
            wallet: Address;
            authenticatorId: string;
            additionalData?: StaticWalletSdkTokenDto["additionalData"];
            pairingId?: string;
        }) {
            try {
                await db
                    .update(ssoTable)
                    .set({
                        resolvedAt: new Date(),
                        wallet,
                        authenticatorId,
                        sdkTokenAdditionalData: additionalData,
                        pairingId,
                    })
                    .where(and(eq(ssoTable.ssoId, id)))
                    .execute();
            } catch (err) {
                log.error({ err }, "Error when resolving the sso session");
            }
        }

        return {
            ...decorators,
            ssoService: {
                resolveSession,
                db,
            },
        };
    })
    .as("plugin");

export type SsoService = (typeof walletSsoService)["decorator"]["ssoService"];
