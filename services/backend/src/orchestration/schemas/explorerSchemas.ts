import { t } from "@backend-utils";
import type { Static } from "elysia";
import { ExplorerConfigSchema } from "../../domain/merchant/schemas";

export const ExplorerMerchantItemSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    explorerConfig: t.Union([ExplorerConfigSchema, t.Null()]),
    activeCampaignCount: t.Number(),
    // How the wallet must build a share link: "native" appends `fCtx` to the
    // merchant domain; "affiliate" goes through the provider share flow (the
    // backend mints the sub-id). Derived from the presence of an affiliate
    // brand link — the frontend stays agnostic of which provider.
    integration: t.Union([t.Literal("native"), t.Literal("affiliate")]),
});

export type ExplorerMerchantItem = Static<typeof ExplorerMerchantItemSchema>;

export const ExplorerQueryResultSchema = t.Object({
    totalResult: t.Number(),
    merchants: t.Array(ExplorerMerchantItemSchema),
});

export type ExplorerQueryResult = Static<typeof ExplorerQueryResultSchema>;
