type ButtonBaseProps = {
    placement?: string;
    target_interaction?: string;
    has_reward?: boolean;
};

type BannerVariant = "referral" | "inapp";
type BannerOutcome = "clicked" | "dismissed";
type PostPurchaseVariant = "referrer" | "referee";
/**
 * Resolved click action reported with `share_button_clicked`.
 *
 * Every click now opens the sharing page, so this only describes the stored
 * merchant config. The named values are the ones the product has shipped;
 * arbitrary strings stay accepted so a config predating the migration is
 * reported faithfully rather than coerced.
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
    share_modal_error: ButtonBaseProps & {
        error?: string;
    };

    // Wallet button (floating) — opens the sharing page and reports
    // `share_button_clicked` like the share button, since both tags now
    // land on the same surface.

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
