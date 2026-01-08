import { JwtContext } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import type {
    StaticExchangeMobileAuthCodeResponseDto,
    StaticGenerateMobileAuthCodeResponseDto,
} from "../models/MobileAuthCodeDto";
import type { WalletSdkSessionService } from "./WalletSdkSessionService";

const usedCodes = new Map<string, number>();
const CODE_CLEANUP_INTERVAL = 60_000;

setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of usedCodes) {
        if (exp < now) {
            usedCodes.delete(jti);
        }
    }
}, CODE_CLEANUP_INTERVAL);

export class MobileAuthCodeService {
    constructor(private walletSdkSessionService: WalletSdkSessionService) {}

    async generateAuthCode({
        walletAddress,
        productId,
        returnOrigin,
    }: {
        walletAddress: Address;
        productId: Hex;
        returnOrigin: string;
    }): Promise<StaticGenerateMobileAuthCodeResponseDto> {
        const jti = crypto.randomUUID();
        const expiresAt = Date.now() + 60_000;

        const authCode = await JwtContext.mobileAuthCode.sign({
            address: walletAddress,
            productId,
            origin: returnOrigin,
            jti,
            sub: walletAddress,
            iat: Date.now(),
        });

        return { authCode, expiresAt };
    }

    async exchangeAuthCode({
        authCode,
        productId,
        requestOrigin,
    }: {
        authCode: string;
        productId: Hex;
        requestOrigin?: string;
    }): Promise<StaticExchangeMobileAuthCodeResponseDto | null> {
        const payload = await JwtContext.mobileAuthCode.verify(authCode);
        if (!payload) {
            return null;
        }

        if (payload.productId !== productId) {
            return null;
        }

        if (requestOrigin && payload.origin !== requestOrigin) {
            return null;
        }

        if (usedCodes.has(payload.jti)) {
            return null;
        }

        usedCodes.set(payload.jti, Date.now() + 60_000);

        const sdkJwt = await this.walletSdkSessionService.generateSdkJwt({
            wallet: payload.address,
        });

        return {
            wallet: payload.address,
            sdkJwt,
        };
    }
}
