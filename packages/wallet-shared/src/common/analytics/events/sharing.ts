type SharingLinkProps = {
    merchant_id?: string;
    link?: string;
};

export type SharingEventMap = {
    sharing_link_shared: SharingLinkProps;
    sharing_link_copied: SharingLinkProps;
    sharing_link_generated: { merchant_id?: string };
    sharing_page_viewed: { merchant_id?: string };
    sharing_page_opened: { merchant_id?: string } | undefined;
};
