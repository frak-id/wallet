/** Where a sharing link event originated, so dashboards can segment by entry point. */
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

/**
 * Set when a native host took the action over and served it with the link IT
 * built. `link` is then absent: this page never sees the string the user got.
 */
type HandedOff = { handed_off?: boolean };

export type SharingEventMap = {
    /**
     * The user asked to share. A `handed_off: true` one is never followed by a
     * `sharing_link_shared` — the host owns the sheet and reports no completion
     * back — so compute the chooser completion rate over `handed_off` false only.
     */
    sharing_link_started: SharingLinkProps & HandedOff;
    /** Completion. Only ever fires for a share this page ran itself. */
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps & HandedOff;
    /** `sdk_version` and `native` are only set when a native host opened the page. */
    sharing_page_viewed: {
        merchant_id?: string;
        sdk_version?: string;
        native?: boolean;
    };
    /**
     * A native host warmed this page, possibly without any user opening a sheet.
     * Kept out of `sharing_page_viewed`, which is the sharing funnel's denominator.
     */
    sharing_page_preloaded: {
        merchant_id?: string;
        sdk_version?: string;
        native?: boolean;
    };
    sharing_page_opened: { merchant_id?: string } | undefined;
};
