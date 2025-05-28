import { sessionContext } from "@backend-common";
import { Elysia } from "elysia";
import type { Address } from "viem";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";

export const walletSdkSessionService = new Elysia({
    name: "Service.walletSdkSession",
})
    .use(sessionContext)
    .decorate(({ walletSdkJwt, ...decorators }) => ({
        /**
         * Generate a JWT token for the SDK
         */
        async generateSdkJwt({
            wallet,
            additionalData,
        }: {
            wallet: Address;
            additionalData?: StaticWalletSdkTokenDto["additionalData"];
        }) {
            // Generate a JWT token for the SDK
            const jwtToken = await walletSdkJwt.sign({
                // Global payload
                address: wallet,
                scopes: ["interaction"],
                // Some JWT specific infos
                sub: wallet,
                iat: Date.now(),
                // Additional data
                additionalData:
                    additionalData && Object.keys(additionalData).length > 0
                        ? additionalData
                        : undefined,
            });

            return {
                token: jwtToken,
                // Tell when the token expires
                expires: Date.now() + 60_000 * 60 * 24 * 7,
            };
        },
        ...decorators,
    }));
