import { JwtContext, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../repositories/IdentityRepository";

export class AnonymousMergeService {
    constructor(private readonly identityRepository: IdentityRepository) {}

    /**
     * Generate a merge token for the source identity.
     *
     * @param sourceGroupId - Pre-resolved identity group ID from orchestrator.
     *   This is the only claim that drives runtime behavior on `execute`.
     * @param sourceAnonymousId - Anonymous fingerprint value (logging only).
     * @param sourceWalletAddress - Source wallet address (logging only).
     *
     * NOTE: The orchestrator handles identity creation via
     * `identityOrchestrator.resolveAndAssociate()` before calling this,
     * which keeps concerns split: orchestrator owns identity lifecycle,
     * service owns token generation.
     */
    async generateToken(params: {
        merchantId: string;
        sourceGroupId: string;
        sourceAnonymousId?: string;
        sourceWalletAddress?: Address;
    }): Promise<{ mergeToken: string; expiresAt: Date }> {
        const {
            sourceAnonymousId,
            sourceWalletAddress,
            merchantId,
            sourceGroupId,
        } = params;

        // Generate the JWT (60-min expiration is configured in JwtContext)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const mergeToken = await JwtContext.anonymousMerge.sign({
            sourceGroupId,
            sourceMerchantId: merchantId,
            sourceAnonymousId,
            sourceWalletAddress,
        });

        log.info(
            { sourceGroupId, merchantId },
            "Anonymous merge token generated"
        );

        return { mergeToken, expiresAt };
    }

    /**
     * Validate a merge token and extract its claims
     */
    async validateToken(params: {
        mergeToken: string;
        merchantId: string;
    }): Promise<{
        sourceGroupId: string;
        sourceMerchantId: string;
        sourceAnonymousId?: string;
        sourceWalletAddress?: Address;
    }> {
        const { mergeToken, merchantId } = params;

        // Verify JWT signature and extract claims
        const tokenPayload = await JwtContext.anonymousMerge.verify(mergeToken);

        if (!tokenPayload) {
            throw HttpError.unauthorized(
                "TOKEN_INVALID",
                "Invalid or expired merge token"
            );
        }

        // Check merchant matches
        if (tokenPayload.sourceMerchantId !== merchantId) {
            throw HttpError.badRequest(
                "MERCHANT_MISMATCH",
                "Token merchant does not match request"
            );
        }

        // Verify source group still exists
        const sourceGroup = await this.identityRepository.findGroupById(
            tokenPayload.sourceGroupId
        );

        if (!sourceGroup) {
            throw HttpError.notFound(
                "SOURCE_NOT_FOUND",
                "Source identity group no longer exists"
            );
        }

        return {
            sourceGroupId: tokenPayload.sourceGroupId,
            sourceMerchantId: tokenPayload.sourceMerchantId,
            sourceAnonymousId: tokenPayload.sourceAnonymousId,
            sourceWalletAddress: tokenPayload.sourceWalletAddress,
        };
    }
}
