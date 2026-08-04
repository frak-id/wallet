import { JwtContext, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { InstallCodeRepository } from "../repositories/InstallCodeRepository";

export class InstallCodeService {
    constructor(
        private readonly installCodeRepository: InstallCodeRepository
    ) {}

    async generate(params: {
        merchantId: string;
        anonymousId: string;
    }): Promise<{ code: string; expiresAt: Date }> {
        const installCode = await this.installCodeRepository.create(params);

        // The code itself never goes to the logs: it is the credential that
        // links an anonymousId to a wallet, and log readers are a far wider
        // set than DB readers. Correlate on the anonymousId instead.
        log.info(
            {
                merchantId: params.merchantId,
                anonymousId: params.anonymousId,
            },
            "Install code generated"
        );

        return {
            code: installCode.code,
            expiresAt: installCode.expiresAt,
        };
    }

    async resolve(params: {
        code: string;
    }): Promise<{ merchantId: string; anonymousId: string }> {
        const installCode = await this.installCodeRepository.findByCode(
            params.code
        );

        if (!installCode) {
            throw HttpError.notFound(
                "CODE_NOT_FOUND",
                "Invalid or expired install code"
            );
        }

        return {
            merchantId: installCode.merchantId,
            anonymousId: installCode.anonymousId,
        };
    }

    /**
     * Mint an install ticket unconditionally from a resolved install-code
     * row — not gated on whether `generate` carried a proof.
     */
    async mintTicket(params: {
        merchantId: string;
        anonymousId: string;
    }): Promise<string> {
        return JwtContext.installTicket.sign({
            aud: "install-ticket",
            sub: params.anonymousId,
            mid: params.merchantId,
            jti: crypto.randomUUID(),
        });
    }

    /**
     * Verify an install ticket, returning the identity it authenticates or
     * `null` when it is missing, expired, or scoped to a different
     * audience. Callers must reject on `null` rather than fall back to a
     * different resolution arm.
     */
    async verifyTicket(ticket: string): Promise<{
        anonymousId: string;
        merchantId: string;
    } | null> {
        const payload = await JwtContext.installTicket.verify(ticket);
        if (!payload) return null;

        return { anonymousId: payload.sub, merchantId: payload.mid };
    }
}
