import { log } from "@backend-common";
import { WebAuthN } from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";

type RegistrationResponse = {
    success: boolean;
    message: string;
    responseObject: {
        userId: string;
        walletAddress: string;
        token: string;
        expiresAt: string;
    };
    statusCode: number;
};

type LoginResponse = {
    success: boolean;
    message: string;
    responseObject: {
        exists: boolean;
        walletAddress: string;
        token: string;
        expiresAt: string;
    };
    statusCode: number;
};

/**
 * Class helping us with 6degrees authentication
 */
export class SixDegreesAuthenticationService {
    constructor(private readonly api: KyInstance) {}

    /**
     * Perform a SixDegrees registration
     */
    async register({
        publicKey,
        challenge,
        signature,
    }: {
        publicKey: Uint8Array;
        challenge: string;
        signature: string;
    }): Promise<string | undefined> {
        try {
            const result = await this.api.post<RegistrationResponse>(
                "api/users/webauthn/register",
                {
                    json: {
                        publicKey: Buffer.from(publicKey).toString("base64"),
                        challenge: challenge,
                        signature: signature,
                        context: {
                            rpId: WebAuthN.rpId,
                            rpOrigin: WebAuthN.rpOrigin,
                            domain: WebAuthN.rpId,
                        },
                    },
                }
            );
            // If we got a token, return it
            const response = await result.json();
            return response?.responseObject?.token ?? undefined;
        } catch (e) {
            log.warn({ e }, "Failed to register with 6degrees");
        }
    }

    /**
     * Perform a SixDegrees login
     */
    async login({
        publicKey,
        challenge,
        signature,
    }: {
        publicKey: Uint8Array;
        challenge: string;
        signature: string;
    }): Promise<string | undefined> {
        try {
            const result = await this.api.post<LoginResponse>(
                "api/users/webauthn/login",
                {
                    json: {
                        publicKey: Buffer.from(publicKey).toString("base64"),
                        challenge: challenge,
                        signature: signature,
                        context: {
                            rpId: WebAuthN.rpId,
                            rpOrigin: WebAuthN.rpOrigin,
                            domain: WebAuthN.rpId,
                        },
                    },
                }
            );
            const response = await result.json();
            return response?.responseObject?.token ?? undefined;
        } catch (e) {
            log.warn({ e }, "Failed to login with 6degrees");
        }
    }
}
