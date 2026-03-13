import { t } from "@backend-utils";
import type { Static } from "elysia";
import { ExplorerConfigSchema } from "../../domain/merchant/schemas";

export const ExplorerMerchantItemSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    explorerConfig: t.Union([ExplorerConfigSchema, t.Null()]),
    activeCampaignCount: t.Number(),
});

export type ExplorerMerchantItem = Static<typeof ExplorerMerchantItemSchema>;

export const ExplorerQueryResultSchema = t.Object({
    totalResult: t.Number(),
    merchants: t.Array(ExplorerMerchantItemSchema),
});

export type ExplorerQueryResult = Static<typeof ExplorerQueryResultSchema>;
