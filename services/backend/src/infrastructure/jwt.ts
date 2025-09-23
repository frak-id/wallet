import { buildJwtContext } from "@backend-utils";
import {
    WalletSdkTokenDto,
    WalletTokenDto,
} from "domain/auth/models/WalletSessionDto";

export namespace JwtContext {
    export const wallet = buildJwtContext({
        secret: process.env.JWT_SECRET as string,
        schema: WalletTokenDto,
        // Default jwt payload
        iss: "frak.id",
    });
    export const walletSdk = buildJwtContext({
        secret: process.env.JWT_SDK_SECRET as string,
        schema: WalletSdkTokenDto,
        // One week
        expirationDelayInSecond: 60 * 60 * 24 * 7,
        // Default jwt payload
        iss: "frak.id",
    });
}
