type ButtonBaseProps = {
    placement?: string;
    target_interaction?: string;
    has_reward?: boolean;
};

type BannerVariant = "referral" | "inapp";
type PostPurchaseVariant = "referrer" | "referee";
type ShareClickAction = "share-modal" | "embedded-wallet" | "sharing-page";

export type SdkComponentEventMap = {
    // Share button — click carries the resolved action + reward presence so
    // we can compare per-merchant configuration impact on conversion.
    share_button_clicked: ButtonBaseProps & {
        click_action: ShareClickAction;
    };
    share_modal_error: ButtonBaseProps & {
        error?: string;
        debug_info?: string;
    };
    share_error_debug_copied: ButtonBaseProps;

    // Wallet button — floating position is all we can reliably capture
    // from the component; wallet status would require a subscription that
    // bloats the bundle, so we skip it for now.
    wallet_button_clicked: ButtonBaseProps & {
        position?: "left" | "right";
    };

    // Open in app — path lets us compare deep-link destinations once we add more.
    open_in_app_clicked: {
        placement?: string;
        path: string;
    };
    open_in_app_login_clicked: {
        placement?: string;
    };
    app_not_installed: {
        placement?: string;
        path: string;
    };

    // Banner — referral vs in-app variants share the funnel shape.
    banner_impression: {
        placement?: string;
        variant: BannerVariant;
        has_reward?: boolean;
    };
    banner_clicked: {
        placement?: string;
        variant: BannerVariant;
    };
    banner_dismissed: {
        placement?: string;
        variant: BannerVariant;
    };

    // Post-purchase — the card drives the highest-intent entry into the
    // referral loop; variant tells us whether we upsold a new share or
    // celebrated an existing referee.
    post_purchase_impression: {
        placement?: string;
        variant: PostPurchaseVariant;
        has_reward?: boolean;
    };
    post_purchase_clicked: {
        placement?: string;
        variant: PostPurchaseVariant;
    };
};
