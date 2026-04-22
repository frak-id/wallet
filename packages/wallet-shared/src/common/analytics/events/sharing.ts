/**
 * Sharing event map — unified across all entry points.
 *
 * `source` is REQUIRED on every link event so dashboards can segment by
 * origin. Five entry points exist today:
 *   - `sharing_page_wallet`    — apps/wallet `/sharing` route
 *   - `sharing_page_listener`  — listener `frak_displaySharingPage` handler
 *   - `modal`                  — listener legacy modal final sharing step
 *   - `embedded_wallet`        — listener embedded wallet view (deprecating)
 *   - `explorer_detail`        — wallet explorer merchant detail card
 *
 * Total sharing events emitted:
 *   - `sharing_page_viewed` / `sharing_page_opened` — lifecycle, no source
 *   - `sharing_link_shared`    — native share succeeded, carries source
 *   - `sharing_link_copied`    — clipboard copy, carries source
 */
export type SharingSource =
    | "sharing_page_wallet"
    | "sharing_page_listener"
    | "modal"
    | "embedded_wallet"
    | "explorer_detail";

type SharingLinkProps = {
    source: SharingSource;
    merchant_id?: string;
    link?: string;
};

export type SharingEventMap = {
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps;
    sharing_page_viewed: { merchant_id?: string };
    sharing_page_opened: { merchant_id?: string } | undefined;
};
