/**
 * Props for the {@link Ambassador} component.
 * @inline
 */
export type AmbassadorProps = {
    /**
     * Override the merchant ID resolved from the SDK config. The store
     * badges' install URL is built from it.
     */
    merchantId?: string;
    /**
     * CSS class names passed through to the root element (Light DOM).
     */
    classname?: string;
    /**
     * Override the hero headline. `{REWARD}` marks the amount; an override using it
     * gives way to the default headline while no fixed amount resolves.
     */
    heroTitle?: string;
    /** Override the hero eyebrow above the headline. */
    heroEyebrow?: string;
    /** Override the hero lede paragraph. Use `{BRAND}` for the merchant name. */
    heroLede?: string;
    /** Override the hero call-to-action label. */
    heroCtaLabel?: string;
    /** Override the hero faces caption under the hero CTA. */
    heroFacesCaption?: string;
    /** Hero photo, shown in a 4:5 frame; without one the frame collapses around the reward card. */
    heroImageUrl?: string;
    /** Override the hero image's alt text. Use `{BRAND}` for the merchant name. */
    heroImageAlt?: string;
    /** Override the hero reward-tag caption next to the amount. */
    heroRewardCaption?: string;
    /** Override the hero referee pill; rendered only when a referee reward resolves. */
    heroRewardRefereePill?: string;
    /** Override the reward region eyebrow. */
    rewardEyebrow?: string;
    /** Override the reward heading; `{REWARD}` marks the amount, as for `heroTitle`. */
    rewardHeading?: string;
    /** Override the estimate caption under the reward heading. */
    rewardEstimateCaption?: string;
    /** Override the reward region lede. */
    rewardLede?: string;
    /** Override the reward region call-to-action label. */
    rewardCtaLabel?: string;
    /** Override the free/no-commitment caption under the reward CTA. */
    rewardFooterCaption?: string;
    /** Override the no-bank-details clause appended to the reward footer caption. */
    rewardNoBankDetails?: string;
    /** Override the amount wording shown when no reward resolves. */
    rewardFallbackLabel?: string;
    /** Override the explainer region heading. Use `{BRAND}` for the merchant name. */
    explainerTitle?: string;
    /** Override the explainer lede under the heading. */
    explainerLede?: string;
    /** Override the first step's title (rendered as an h3). */
    step1Title?: string;
    /** Override the first step's description. */
    step1Description?: string;
    /** Override the first step's image URL. Falls back to the step number. */
    step1ImageUrl?: string;
    /** Override the first step image's alt text. Defaults to the step title. */
    step1ImageAlt?: string;
    /** Override the second step's title (rendered as an h3). */
    step2Title?: string;
    /** Override the second step's description; used only when the campaign rewards the friend. */
    step2Description?: string;
    /** Override the second step's image URL. Falls back to the step number. */
    step2ImageUrl?: string;
    /** Override the second step image's alt text. Defaults to the step title. */
    step2ImageAlt?: string;
    /** Override the third step's title (rendered as an h3). */
    step3Title?: string;
    /** Override the third step's description. */
    step3Description?: string;
    /** Override the third step's image URL. Falls back to the step number. */
    step3ImageUrl?: string;
    /** Override the third step image's alt text. Defaults to the step title. */
    step3ImageAlt?: string;
    /** Override the win-win region heading. */
    winWinHeading?: string;
    /** Override the win-win region lede. Use `{BRAND}` for the merchant name. */
    winWinLede?: string;
    /** Override the referrer card's label in the win-win region. */
    winWinCard1Title?: string;
    /** Override the referrer card's description. */
    winWinCard1Description?: string;
    /** Override the friend card's label in the win-win region. */
    winWinCard2Title?: string;
    /** Override the friend card's description. */
    winWinCard2Description?: string;
    /** Override the referral block heading. */
    referralHeading?: string;
    /** Override the referral block's share sentence. */
    referralLede?: string;
    /** Override the referral block's share-button label. */
    referralCtaLabel?: string;
    /** Override the store block heading. */
    storeHeading?: string;
    /** Override the store block lede under the heading. */
    storeLede?: string;
    /** Override the App Store badge's accessible name. */
    storeAppBadgeAriaLabel?: string;
    /** Override the Google Play badge's accessible name. */
    storePlayBadgeAriaLabel?: string;
    /** Override the store QR code's accessible name. */
    storeQrLabel?: string;
    /** Override the store QR code's visible caption. */
    storeQrCaption?: string;
    /** Override the FAQ region heading. */
    faqHeading?: string;
    /** Override the first FAQ question. */
    faq1Question?: string;
    /** Override the first FAQ answer. */
    faq1Answer?: string;
    /** Override the second FAQ question. */
    faq2Question?: string;
    /** Override the second FAQ answer. */
    faq2Answer?: string;
    /** Override the third FAQ question. */
    faq3Question?: string;
    /** Override the third FAQ answer; used only when the campaign rewards the friend. */
    faq3Answer?: string;
    /** Override the fourth FAQ question. */
    faq4Question?: string;
    /** Override the fourth FAQ answer. */
    faq4Answer?: string;
    /** Override the fifth FAQ question. */
    faq5Question?: string;
    /** Override the fifth FAQ answer text before the frak.id anchor. */
    faq5AnswerBeforeLink?: string;
    /** Override the frak.id anchor's text inside the fifth FAQ answer. */
    faq5AnswerLinkText?: string;
    /** Override the fifth FAQ answer text after the frak.id anchor. */
    faq5AnswerAfterLink?: string;
    /** Override the attribution text before the frak.id anchor. */
    attributionBeforeLink?: string;
    /** Override the attribution anchor's text. */
    attributionLinkText?: string;
};
