import type { Address } from "viem";
import type { AttributionService } from "../../domain/attribution/services/AttributionService";
import type { PurchaseContext } from "../../domain/campaign";
import type { IdentityRepository } from "../../domain/identity";
import type { InteractionLogSelect } from "../../domain/rewards/db/schema";
import type {
    PurchasePayload,
    WalletConnectPayload,
} from "../../domain/rewards/types";
import type {
    InteractionContextResult,
    TypeSpecificContextResult,
} from "./types";

export class InteractionContextBuilder {
    constructor(
        private readonly attributionService: AttributionService,
        private readonly identityRepositpry: IdentityRepository
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
            ? await this.identityRepositpry.findGroupByIdentity({
                  type: "wallet",
                  value: attribution.referrerWallet,
              })
            : null;

        const { trigger, typeContext, walletAddressOverride } =
            this.buildTypeSpecific(interaction, walletAddress);

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
                    walletAddress: walletAddressOverride ?? walletAddress,
                },
            },
        };
    }

    private buildTypeSpecific(
        interaction: InteractionLogSelect,
        walletAddress: Address | null
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

            case "wallet_connect": {
                const payload = interaction.payload as WalletConnectPayload;
                return {
                    trigger: "wallet_connect",
                    typeContext: {},
                    walletAddressOverride: payload.wallet ?? walletAddress,
                };
            }

            default:
                return {
                    trigger: "custom",
                    typeContext: {},
                };
        }
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
