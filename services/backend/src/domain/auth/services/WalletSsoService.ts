import { log } from "@backend-common";
import { db } from "@backend-common";
import { and, eq } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { ssoTable } from "../db/schema";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";

export class WalletSsoService {
    async resolveSession({
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
        } catch (error) {
            log.error({ error }, "Error when resolving the sso session");
        }
    }
}
