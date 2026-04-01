import { log } from "@backend-infrastructure";
import type { InstallCodeRepository } from "../repositories/InstallCodeRepository";

type ResolveResult =
    | {
          success: true;
          merchantId: string;
          anonymousId: string;
      }
    | { success: false; error: string; code: string };

type ConsumeResult<T> =
    | { success: true; result: T }
    | { success: false; error: string; code: string };

export class InstallCodeService {
    constructor(
        private readonly installCodeRepository: InstallCodeRepository
    ) {}

    async generate(params: {
        merchantId: string;
        anonymousId: string;
    }): Promise<{ code: string; expiresAt: Date }> {
        const installCode = await this.installCodeRepository.create(params);

        log.info(
            { merchantId: params.merchantId, code: installCode.code },
            "Install code generated"
        );

        return {
            code: installCode.code,
            expiresAt: installCode.expiresAt,
        };
    }

    async resolve(params: { code: string }): Promise<ResolveResult> {
        const installCode = await this.installCodeRepository.findByCode(
            params.code
        );

        if (!installCode) {
            return {
                success: false,
                error: "Invalid or expired install code",
                code: "CODE_NOT_FOUND",
            };
        }

        return {
            success: true,
            merchantId: installCode.merchantId,
            anonymousId: installCode.anonymousId,
        };
    }

    async consume<T>(params: {
        code: string;
        onConsume: (installCode: {
            merchantId: string;
            anonymousId: string;
        }) => Promise<T>;
    }): Promise<ConsumeResult<T>> {
        const consumed = await this.installCodeRepository.consumeByCode(
            params.code,
            async (installCode) =>
                params.onConsume({
                    merchantId: installCode.merchantId,
                    anonymousId: installCode.anonymousId,
                })
        );

        if (!consumed) {
            return {
                success: false,
                error: "Invalid or expired install code",
                code: "CODE_NOT_FOUND",
            };
        }

        this.installCodeRepository.deleteExpired().catch(() => {});

        return { success: true, result: consumed.result };
    }
}
