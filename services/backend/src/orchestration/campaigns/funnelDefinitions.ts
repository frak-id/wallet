import type {
    FunnelStepDefinition,
    OpenPanelChartFilter,
} from "../../infrastructure/integrations/openpanel";
import type {
    OverviewFunnelKind,
    OverviewSharingDeviceKind,
} from "../schemas/campaignOverviewSchemas";

/**
 * Campaign-product funnel + sharing definitions for the overview
 * dashboard. Pure data: lists of OpenPanel event names per funnel
 * step, the set of `properties.source` values we classify as
 * "wallet" vs "website", and the device-class mapping.
 *
 * Generic chart-building (request layout) + response-parsing lives
 * in `infrastructure/integrations/openpanel/funnels.ts`. This module
 * only declares WHAT a campaign funnel is, not HOW to query for it.
 */

/**
 * Sources from which a share was initiated inside the Frak wallet
 * app. Used by the wallet-funnel and by the merchant-vs-wallet
 * sharing split.
 */
export const WALLET_SHARING_SOURCES = [
    "sharing_page_wallet",
    "explorer_detail",
    "welcome_card",
];

/**
 * Sources from which a share was initiated on the merchant's own
 * site (SDK listener iframe, modal, embedded widget).
 */
export const WEBSITE_SHARING_SOURCES = [
    "sharing_page_listener",
    "modal",
    "embedded_wallet",
];

/**
 * OpenPanel's autotracked `device` property is `"mobile" | "desktop"
 * | "tablet"` (plus the empty string when missing). Anything outside
 * that maps to `"other"` so the FE never receives an unbounded label.
 */
export const DEVICE_KIND_MAP: Record<string, OverviewSharingDeviceKind> = {
    mobile: "mobile",
    desktop: "desktop",
    tablet: "tablet",
};

/**
 * Website-side share funnel — share CTAs shown on the merchant's own
 * pages, leading to a `sharing_link_shared` or `sharing_link_copied`
 * event.
 */
export function websiteFunnelDefinition(): FunnelStepDefinition<OverviewFunnelKind>[] {
    const sourceFilter: OpenPanelChartFilter = {
        name: "properties.source",
        operator: "is",
        value: WEBSITE_SHARING_SOURCES,
    };
    return [
        { kind: "share_cta_seen", eventNames: ["sharing_page_viewed"] },
        {
            kind: "share_initiated",
            eventNames: ["sharing_link_started", "sharing_link_copied"],
            extraFilters: [sourceFilter],
        },
        {
            kind: "link_shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [sourceFilter],
        },
    ];
}

/**
 * Wallet-app share funnel — share CTAs shown inside the Frak wallet
 * (explorer detail, welcome card, sharing page). Has two extra steps
 * before the share itself because wallet shares come from explorer
 * impressions, not banner impressions.
 */
export function walletFunnelDefinition(): FunnelStepDefinition<OverviewFunnelKind>[] {
    const sourceFilter: OpenPanelChartFilter = {
        name: "properties.source",
        operator: "is",
        value: WALLET_SHARING_SOURCES,
    };
    const explorerModalFilter: OpenPanelChartFilter = {
        name: "properties.modal",
        operator: "is",
        value: ["explorerDetail"],
    };
    return [
        { kind: "explorer_impressions", eventNames: ["explorer_card_viewed"] },
        {
            kind: "brand_page_opened",
            eventNames: ["wallet_modal_opened"],
            extraFilters: [explorerModalFilter],
        },
        {
            kind: "share_initiated",
            eventNames: ["sharing_link_started", "sharing_link_copied"],
            extraFilters: [sourceFilter],
        },
        {
            kind: "link_shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [sourceFilter],
        },
    ];
}
