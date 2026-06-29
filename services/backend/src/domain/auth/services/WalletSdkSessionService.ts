import { JwtContext } from "@backend-infrastructure";
import type { Address } from "viem";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";

export class WalletSdkSessionService {
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
        const jwtToken = await JwtContext.walletSdk.sign({
            // Global payload
            address: wallet,
            scopes: ["interaction"],
            // Some JWT specific infos
            sub: wallet,
            // Additional data
            additionalData:
                additionalData && Object.keys(additionalData).length > 0
                    ? additionalData
                    : undefined,
        });

        return {
            token: jwtToken,
            // Tell when the token expires (1 day)
            expires: Date.now() + 60_000 * 60 * 24 * 1,
        };
    }
}
