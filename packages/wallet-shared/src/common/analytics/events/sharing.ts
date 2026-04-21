type SharingLinkProps = {
    merchant_id?: string;
    link?: string;
};

/**
 * Sharing event map.
 *
 * Both wallet and listener emit sharing events, so the map lives in
 * wallet-shared. Legacy kebab-case names are retained here during the
 * migration window to keep historical dashboards valid; new callsites should
 * target the snake_case variants.
 */
export type SharingEventMap = {
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps;
    sharing_link_generated: { merchant_id?: string };
    sharing_page_viewed: { merchant_id?: string };
    // Legacy kebab-case (to be migrated — see tagging plan §1)
    "sharing-share-link": SharingLinkProps;
    "sharing-copy-link": SharingLinkProps;
};
