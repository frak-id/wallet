import { log } from "@backend-infrastructure";
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

        log.info(
            { merchantId: params.merchantId, code: installCode.code },
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
}
