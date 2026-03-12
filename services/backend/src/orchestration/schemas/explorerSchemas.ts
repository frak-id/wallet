import { t } from "@backend-utils";
import { MerchantAppearanceSchema } from "../../domain/merchant/schemas";

export const ExplorerMerchantItemSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    appearance: t.Union([MerchantAppearanceSchema, t.Null()]),
    activeCampaignCount: t.Number(),
});

export const ExplorerQueryResultSchema = t.Object({
    totalResult: t.Number(),
    merchants: t.Array(ExplorerMerchantItemSchema),
});
