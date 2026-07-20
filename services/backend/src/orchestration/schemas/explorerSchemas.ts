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
    // Interaction count over the last month — a coarse popularity rating used
    // by the frontend to surface merchants users engage with the most.
    popularity: t.Number(),
    // Total `explorer_card_viewed` impressions for this merchant, sourced from
    // OpenPanel (heavily cached, see ExplorerOrchestrator). A top-of-funnel
    // visibility signal, distinct from `popularity` (actual interactions).
    views: t.Number(),
    // ISO timestamp of the freshest active campaign (published-, else created-
    // at), so the frontend can sort by campaign freshness. Null shouldn't
    // happen (listed merchants always have an active campaign) but stays
    // nullable for safety.
    recent: t.Union([t.String(), t.Null()]),
    // ISO timestamp of the soonest-expiring active campaign. Null when no
    // active campaign carries an end date.
    expiring: t.Union([t.String(), t.Null()]),
    // Highest reward a user could earn across the merchant's active campaigns,
    // expressed in euros. Percentage rewards are valued against a reference
    // basket (see ExplorerOrchestrator). Null when no reward can be valued.
    reward: t.Union([t.Number(), t.Null()]),
});

export type ExplorerMerchantItem = Static<typeof ExplorerMerchantItemSchema>;

export const ExplorerQueryResultSchema = t.Object({
    totalResult: t.Number(),
    merchants: t.Array(ExplorerMerchantItemSchema),
});

export type ExplorerQueryResult = Static<typeof ExplorerQueryResultSchema>;
