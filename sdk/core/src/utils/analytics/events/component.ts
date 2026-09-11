type ButtonBaseProps = {
    placement?: string;
    target_interaction?: string;
    has_reward?: boolean;
};

type BannerVariant = "referral" | "inapp";
type BannerOutcome = "clicked" | "dismissed";
type PostPurchaseVariant = "referrer" | "referee";
/**
 * Resolved click action reported with `share_button_clicked`. It describes the
 * stored merchant config only — every click opens the sharing page. Arbitrary
 * strings stay accepted so an unknown config is reported, not coerced.
 */
type ShareClickAction =
    | "share-modal"
    | "embedded-wallet"
    | "sharing-page"
    | (string & {});

export type SdkComponentEventMap = {
    // Share button — click carries the resolved action + reward presence so
    // we can compare per-merchant configuration impact on conversion.
    share_button_clicked: ButtonBaseProps & {
        click_action: ShareClickAction;
    };

    // Open in app — path lets us compare deep-link destinations once we add more.
    open_in_app_clicked: {
        placement?: string;
        path: string;
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
    banner_resolved: {
        placement?: string;
        variant: BannerVariant;
        outcome: BannerOutcome;
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
