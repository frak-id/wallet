import { log } from "@backend-infrastructure";
import type { ReferralCodeSelect } from "../db/schema";
import type { ReferralCodeRepository } from "../repositories/ReferralCodeRepository";

type IssueResult =
    | { success: true; code: ReferralCodeSelect }
    | { success: false; error: string; code: "ALREADY_ACTIVE" };

type RotateResult =
    | { success: true; code: ReferralCodeSelect }
    | { success: false; error: string; code: "NO_ACTIVE_CODE" };

export class ReferralCodeService {
    constructor(
        private readonly referralCodeRepository: ReferralCodeRepository
    ) {}

    /**
     * Issue a new active code for the owner. Fails if the owner already has
     * an active code (callers should call `rotate` instead).
     */
    async issue(params: {
        ownerIdentityGroupId: string;
    }): Promise<IssueResult> {
        const existing = await this.referralCodeRepository.findActiveByOwner(
            params.ownerIdentityGroupId
        );
        if (existing) {
            return {
                success: false,
                error: "An active referral code already exists for this user",
                code: "ALREADY_ACTIVE",
            };
        }

        const created = await this.referralCodeRepository.create(params);
        if (!created) {
            // Concurrent issue lost the race against the partial unique —
            // behave as if the other caller won.
            return {
                success: false,
                error: "An active referral code already exists for this user",
                code: "ALREADY_ACTIVE",
            };
        }

        log.info(
            {
                ownerIdentityGroupId: params.ownerIdentityGroupId,
                code: created.code,
            },
            "Referral code issued"
        );

        return { success: true, code: created };
    }

    /**
     * Revoke the current active code (if any) and issue a new one. Fails if
     * the owner has no active code — callers should call `issue` instead.
     */
    async rotate(params: {
        ownerIdentityGroupId: string;
    }): Promise<RotateResult> {
        const revoked = await this.referralCodeRepository.revokeActiveByOwner(
            params.ownerIdentityGroupId
        );
        if (!revoked) {
            return {
                success: false,
                error: "No active referral code to rotate",
                code: "NO_ACTIVE_CODE",
            };
        }

        const created = await this.referralCodeRepository.create(params);
        if (!created) {
            // Extremely unlikely: revocation succeeded but the new insert
            // could not find a free candidate. Surface as 500 upstream.
            throw new Error("Failed to create replacement code after rotation");
        }

        log.info(
            {
                ownerIdentityGroupId: params.ownerIdentityGroupId,
                oldCodeId: revoked.id,
                newCode: created.code,
            },
            "Referral code rotated"
        );

        return { success: true, code: created };
    }

    /**
     * Revoke the active code without replacement. No-op if the owner has no
     * active code.
     */
    async revoke(params: { ownerIdentityGroupId: string }): Promise<void> {
        const revoked = await this.referralCodeRepository.revokeActiveByOwner(
            params.ownerIdentityGroupId
        );
        if (revoked) {
            log.info(
                {
                    ownerIdentityGroupId: params.ownerIdentityGroupId,
                    codeId: revoked.id,
                },
                "Referral code revoked"
            );
        }
    }

    async findActiveByOwner(
        ownerIdentityGroupId: string
    ): Promise<ReferralCodeSelect | null> {
        return this.referralCodeRepository.findActiveByOwner(
            ownerIdentityGroupId
        );
    }

    async findByCode(code: string): Promise<ReferralCodeSelect | null> {
        return this.referralCodeRepository.findByCode(code);
    }
}
