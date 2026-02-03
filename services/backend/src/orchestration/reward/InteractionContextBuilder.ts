import type { Address } from "viem";
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
        private readonly identityRepository: IdentityRepository
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

        const referrerIdentityGroup = attribution.referrerWallet
            ? await this.identityRepository.findGroupByIdentity({
                  type: "wallet",
                  value: attribution.referrerWallet,
              })
            : null;

        const { trigger, typeContext } = this.buildTypeSpecific(interaction);

        return {
            trigger,
            context: {
                ...typeContext,
                attribution: {
                    source: attribution.source,
                    touchpointId: attribution.touchpointId,
                    referrerWallet: attribution.referrerWallet,
                    referrerIdentityGroupId: referrerIdentityGroup?.id ?? null,
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
