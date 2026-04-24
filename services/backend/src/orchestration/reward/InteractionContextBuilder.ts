import type { Address } from "viem";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { AttributionService } from "../../domain/attribution/services/AttributionService";
import type { PurchaseContext } from "../../domain/campaign";
import type { IdentityRepository } from "../../domain/identity";
import type { InteractionLogSelect } from "../../domain/rewards/db/schema";
import type {
    CustomPayload,
    PurchasePayload,
} from "../../domain/rewards/types";
import type {
    CustomContext,
    InteractionContextResult,
    TypeSpecificContextResult,
} from "./types";

export class InteractionContextBuilder {
    constructor(
        private readonly attributionService: AttributionService,
        private readonly identityRepository: IdentityRepository,
        private readonly referralLinkRepository: ReferralLinkRepository
    ) {}

    async build(
        interaction: InteractionLogSelect,
        merchantId: string,
        identityGroupId: string,
        walletAddress: Address | null
    ): Promise<InteractionContextResult> {
        const attribution = await this.attributionService.attributeConversion({
            identityGroupId,
            merchantId,
        });

        // Touchpoint-derived referrer (merchant-scoped arrival attribution)
        // takes precedence; cross-merchant referrers (referral-code
        // redemptions) act as the fallback referrer-of-last-resort.
        const touchpointReferrerId = attribution.referrerIdentity
            ? ((
                  await this.identityRepository.findGroupByIdentity(
                      attribution.referrerIdentity
                  )
              )?.id ?? null)
            : null;

        const referrerIdentityGroupId =
            touchpointReferrerId ??
            (
                await this.referralLinkRepository.findReferrerForReferee(
                    merchantId,
                    identityGroupId
                )
            )?.referrerIdentityGroupId ??
            null;

        const { trigger, typeContext } = this.buildTypeSpecific(interaction);

        return {
            trigger,
            context: {
                ...typeContext,
                attribution: {
                    source: attribution.source,
                    touchpointId: attribution.touchpointId,
                    referrerIdentityGroupId,
                },
                user: {
                    identityGroupId,
                    walletAddress,
                },
            },
        };
    }

    private buildTypeSpecific(
        interaction: InteractionLogSelect
    ): TypeSpecificContextResult {
        switch (interaction.type) {
            case "purchase": {
                const payload = interaction.payload as PurchasePayload;
                return {
                    trigger: "purchase",
                    typeContext: {
                        purchase: this.buildPurchaseContext(payload),
                    },
                };
            }

            case "referral":
                return {
                    trigger: "referral",
                    typeContext: {},
                };

            case "create_referral_link":
                return {
                    trigger: "create_referral_link",
                    typeContext: {},
                };

            case "custom": {
                const payload = interaction.payload as CustomPayload;
                return {
                    trigger: "custom",
                    typeContext: {
                        custom: this.buildCustomContext(payload),
                    },
                };
            }
        }
    }

    private buildCustomContext(payload: CustomPayload): CustomContext {
        return {
            customType: payload.customType,
            data: payload.data,
        };
    }

    private buildPurchaseContext(payload: PurchasePayload): PurchaseContext {
        return {
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            items: payload.items.map((item) => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
            })),
        };
    }
}
