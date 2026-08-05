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
 *   - `sharing_page_preloaded` — a host warmed the page; NOT a view, see below
 *   - `sharing_link_started`   — user triggered the share flow (intent), carries source
 *   - `sharing_link_shared`    — native share succeeded, carries source
 *   - `sharing_link_copied`    — clipboard copy, carries source
 *
 * `sharing_link_started` is emitted before the OS share sheet opens and
 * has no completion guarantee. Comparing it against `sharing_link_shared`
 * yields the share-completion rate (drop-offs in the native chooser).
 */
export type SharingSource =
    | "sharing_page_wallet"
    | "sharing_page_listener"
    | "modal"
    | "embedded_wallet"
    | "explorer_detail"
    | "welcome_card";

type SharingLinkProps = {
    source: SharingSource;
    merchant_id?: string;
    link?: string;
};

export type SharingEventMap = {
    sharing_link_started: SharingLinkProps;
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps;
    /**
     * `sdk_version` and `native` are only present when a native host opened
     * the page. They are what tells us which SDK builds are still in the
     * field, so a page change can be weighed against what it would break in
     * binaries that can no longer be updated.
     */
    sharing_page_viewed: {
        merchant_id?: string;
        sdk_version?: string;
        native?: boolean;
    };
    /**
     * A native host warmed this page against a real merchant, before — and possibly
     * without — any user opening a sheet. Deliberately not `sharing_page_viewed`: that
     * event is the sharing funnel's denominator, and counting warm-ups in it would
     * silently deflate every downstream rate.
     *
     * Useful on its own as the preload hit rate: compare against the `sharing_page_viewed`
     * that carries `native`, and the gap is warming we paid for and nobody used.
     */
    sharing_page_preloaded: {
        merchant_id?: string;
        sdk_version?: string;
        native?: boolean;
    };
    sharing_page_opened: { merchant_id?: string } | undefined;
};
