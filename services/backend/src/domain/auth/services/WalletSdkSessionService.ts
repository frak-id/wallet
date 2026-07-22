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
        const jwtToken = await JwtContext.walletSdk.sign({
            address: wallet,
            scopes: ["interaction"],
            sub: wallet,
            additionalData:
                additionalData && Object.keys(additionalData).length > 0
                    ? additionalData
                    : undefined,
        });

        return {
            token: jwtToken,
            expires: Date.now() + 60_000 * 60 * 24,
        };
    }
}
