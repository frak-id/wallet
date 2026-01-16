import { JwtContext, log } from "@backend-infrastructure";
import type { IdentityRepository } from "../repositories/IdentityRepository";

type GenerateTokenResult =
    | { success: true; mergeToken: string; expiresAt: Date }
    | { success: false; error: string; code: string };

type ValidateTokenResult =
    | {
          success: true;
          sourceGroupId: string;
          sourceMerchantId: string;
          sourceAnonymousId: string;
      }
    | { success: false; error: string; code: string };

export class AnonymousMergeService {
    constructor(private readonly identityRepository: IdentityRepository) {}

    /**
     * Generate a merge token for the source anonymous identity
     *
     * @param sourceGroupId - Pre-resolved identity group ID from orchestrator
     *
     * NOTE: This service was simplified to receive sourceGroupId directly
     * instead of looking it up. The orchestrator handles identity creation
     * via identityOrchestrator.resolveAndAssociate() before calling this.
     * This separates concerns: orchestrator handles identity lifecycle,
     * service handles token generation.
     */
    async generateToken(params: {
        sourceAnonymousId: string;
        merchantId: string;
        sourceGroupId: string;
    }): Promise<GenerateTokenResult> {
        const { sourceAnonymousId, merchantId, sourceGroupId } = params;

        // Generate the JWT (60-min expiration is configured in JwtContext)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const mergeToken = await JwtContext.anonymousMerge.sign({
            sourceGroupId,
            sourceMerchantId: merchantId,
            sourceAnonymousId,
        });

        log.info(
            { sourceGroupId, merchantId },
            "Anonymous merge token generated"
        );

        return { success: true, mergeToken, expiresAt };
    }

    /**
     * Validate a merge token and extract its claims
     */
    async validateToken(params: {
        mergeToken: string;
        merchantId: string;
    }): Promise<ValidateTokenResult> {
        const { mergeToken, merchantId } = params;

        // Verify JWT signature and extract claims
        const tokenPayload = await JwtContext.anonymousMerge.verify(mergeToken);

        if (!tokenPayload) {
            return {
                success: false,
                error: "Invalid or expired merge token",
                code: "TOKEN_INVALID",
            };
        }

        // Check merchant matches
        if (tokenPayload.sourceMerchantId !== merchantId) {
            return {
                success: false,
                error: "Token merchant does not match request",
                code: "MERCHANT_MISMATCH",
            };
        }

        // Verify source group still exists
        const sourceGroup = await this.identityRepository.findGroupById(
            tokenPayload.sourceGroupId
        );

        if (!sourceGroup) {
            return {
                success: false,
                error: "Source identity group no longer exists",
                code: "SOURCE_NOT_FOUND",
            };
        }

        return {
            success: true,
            sourceGroupId: tokenPayload.sourceGroupId,
            sourceMerchantId: tokenPayload.sourceMerchantId,
            sourceAnonymousId: tokenPayload.sourceAnonymousId,
        };
    }
}
