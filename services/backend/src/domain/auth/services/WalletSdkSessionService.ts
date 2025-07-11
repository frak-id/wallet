import type { SessionContextType } from "@backend-common";
import type { Address } from "viem";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";

export class WalletSdkSessionService {
    constructor(
        private readonly walletSdkJwt: SessionContextType["decorator"]["walletSdkJwt"]
    ) {}

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
        const jwtToken = await this.walletSdkJwt.sign({
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
    }
}
