import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
import { requireMoneriumConfig } from "../config";
import type { MoneriumAuthMethod, MoneriumPendingAuthRow } from "../db/schema";
import { MoneriumApiError, rethrowUpstream } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumPendingAuthRepository } from "../repositories/MoneriumPendingAuthRepository";
import type { MoneriumTrackedOrderRepository } from "../repositories/MoneriumTrackedOrderRepository";
import { type MoneriumStatusResponse, moneriumErrorCodes } from "../schemas";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import { isSilentReconnectEligible } from "./MoneriumStatusService";
import type { MoneriumTokenCipher } from "./MoneriumTokenCipher";
import {
    codeChallengeS256,
    generateAuthState,
    generateCodeVerifier,
} from "./pkce";
import { buildMoneriumSiweMessage, SIWE_VALIDITY_MS } from "./siweMessage";

const PENDING_AUTH_TTL_MS = 30 * 60_000;

function invalidState(): HttpError {
    return HttpError.badRequest(
        moneriumErrorCodes.authStateInvalid,
        "The Monerium authorization expired or is unknown, start again"
    );
}

function isUsable(
    pending: MoneriumPendingAuthRow | undefined,
    method: MoneriumAuthMethod
): pending is MoneriumPendingAuthRow {
    return (
        pending !== undefined &&
        pending.method === method &&
        pending.expiresAt.getTime() > Date.now()
    );
}

export class MoneriumAuthService {
    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly pendingAuths: MoneriumPendingAuthRepository,
        private readonly trackedOrders: MoneriumTrackedOrderRepository,
        private readonly cipher: MoneriumTokenCipher,
        private readonly client: MoneriumApiClient,
        private readonly status: MoneriumStatusService
    ) {}

    async start(params: {
        wallet: Address;
        authMode?: "login" | "signup";
    }): Promise<{ url: string }> {
        const verifier = generateCodeVerifier();
        const state = generateAuthState();
        const url = this.client.authorizeUrl({
            codeChallenge: codeChallengeS256(verifier),
            state,
            authMode: params.authMode,
        });
        await this.pendingAuths.create({
            state,
            wallet: params.wallet,
            method: "oauth",
            codeVerifierEncrypted: await this.cipher.encrypt(
                verifier,
                params.wallet,
                "code_verifier_encrypted"
            ),
            siweMessage: null,
            expiresAt: new Date(Date.now() + PENDING_AUTH_TTL_MS),
        });
        return { url };
    }

    async handleCallback(params: {
        wallet: Address;
        code: string;
        state: string;
    }): Promise<MoneriumStatusResponse> {
        const pending = await this.pendingAuths.consume(
            params.state,
            params.wallet
        );
        if (!isUsable(pending, "oauth")) throw invalidState();

        const verifier = await this.cipher.decrypt(
            pending.codeVerifierEncrypted,
            params.wallet,
            "code_verifier_encrypted"
        );
        return this.connect(params.wallet, params.code, verifier);
    }

    /** Only offered to wallets worth a passkey prompt: see `isSilentReconnectEligible`. */
    async prepareSiwe(params: {
        wallet: Address;
    }): Promise<{ state: string; message: string }> {
        const config = requireMoneriumConfig();
        const row = await this.connections.findByWallet(params.wallet);
        if (!row || !isSilentReconnectEligible(row)) {
            throw HttpError.conflict(
                moneriumErrorCodes.siweUnavailable,
                "Silent reconnection is not available for this wallet"
            );
        }

        const state = generateAuthState();
        const now = new Date();
        const message = buildMoneriumSiweMessage({
            address: params.wallet,
            config,
            now,
        });
        await this.pendingAuths.create({
            state,
            wallet: params.wallet,
            method: "siwe",
            codeVerifierEncrypted: await this.cipher.encrypt(
                generateCodeVerifier(),
                params.wallet,
                "code_verifier_encrypted"
            ),
            siweMessage: message,
            expiresAt: new Date(now.getTime() + SIWE_VALIDITY_MS),
        });
        return { state, message };
    }

    async submitSiwe(params: {
        wallet: Address;
        state: string;
        signature: Hex;
    }): Promise<MoneriumStatusResponse> {
        const pending = await this.pendingAuths.consume(
            params.state,
            params.wallet
        );
        if (!isUsable(pending, "siwe") || !pending.siweMessage) {
            throw invalidState();
        }

        const verifier = await this.cipher.decrypt(
            pending.codeVerifierEncrypted,
            params.wallet,
            "code_verifier_encrypted"
        );
        const outcome = await this.client
            .submitSiwe({
                message: pending.siweMessage,
                signature: params.signature,
                codeChallenge: codeChallengeS256(verifier),
                state: params.state,
            })
            .catch(rethrowUpstream);

        if (outcome.kind !== "code") {
            if (outcome.kind !== "unexpected") {
                await this.connections.update(params.wallet, {
                    siweFailedAt: new Date(),
                });
            }
            log.warn(
                {
                    outcome: outcome.kind,
                    error: "error" in outcome ? outcome.error : undefined,
                },
                "[Monerium] SIWE not accepted, falling back to the portal"
            );
            throw HttpError.unprocessable(
                moneriumErrorCodes.siweRejected,
                "Monerium rejected the sign-in signature"
            );
        }

        return this.connect(params.wallet, outcome.code, verifier);
    }

    /** Forgets everything Frak holds for the wallet. Monerium itself is untouched. */
    async disconnect(wallet: Address): Promise<void> {
        await this.connections.deleteByWallet(wallet);
        await this.pendingAuths.deleteByWallet(wallet);
        await this.trackedOrders.deleteByWallet(wallet);
    }

    private async connect(
        wallet: Address,
        code: string,
        verifier: string
    ): Promise<MoneriumStatusResponse> {
        const tokens = await this.client
            .exchangeAuthorizationCode({ code, codeVerifier: verifier })
            .catch((error: unknown) => {
                if (
                    error instanceof MoneriumApiError &&
                    !error.isUpstreamFailure
                ) {
                    throw HttpError.unprocessable(
                        moneriumErrorCodes.tokenExchangeFailed,
                        "Monerium refused the authorization code"
                    );
                }
                return rethrowUpstream(error);
            });

        await this.connections.upsertConnected({
            wallet,
            accessTokenEncrypted: await this.cipher.encrypt(
                tokens.accessToken,
                wallet,
                "access_token_encrypted"
            ),
            accessTokenExpiresAt: new Date(
                Date.now() + tokens.expiresInSeconds * 1000
            ),
            refreshTokenEncrypted: await this.cipher.encrypt(
                tokens.refreshToken,
                wallet,
                "refresh_token_encrypted"
            ),
        });
        return this.status.getStatus(wallet, { refresh: true });
    }
}
