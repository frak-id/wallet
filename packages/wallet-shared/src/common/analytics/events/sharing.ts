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

export type SharingEventMap = {
    sharing_link_started: SharingLinkProps;
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps;
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
