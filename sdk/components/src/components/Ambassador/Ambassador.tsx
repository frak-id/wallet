import { getInstallUrl } from "@frak-labs/core-sdk/actions";
import { applyRewardPlaceholder } from "@frak-labs/core-sdk/rewards";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";
import { openSharingPage } from "@/actions/sharingPage";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useHostTheme } from "@/hooks/useHostTheme";
import { useLang } from "@/hooks/useLang";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { useReward } from "@/hooks/useReward";
import { componentDefaults } from "@/i18n/defaults";
import { cssSource as sharedBaseCss } from "@/styles/sharedBaseCss.css";
import {
    amountUnit,
    amountWords,
    cssSource,
    faq,
    faqAnswer,
    faqAttribution,
    faqItem,
    faqQuestion,
    faqTitle,
    frakLink,
    hero,
    heroAmount,
    heroArt,
    heroArtFramed,
    heroBody,
    heroCta,
    heroEyebrow,
    heroFaces,
    heroImage,
    heroLede,
    heroPill,
    heroRewardCaption,
    heroTag,
    heroTagMain,
    heroTitle,
    referral,
    referralCta,
    referralLede,
    referralTitle,
    rewardAmount,
    rewardCaption,
    rewardCta,
    rewardEyebrow,
    rewardFooter,
    rewardHeading,
    rewardHeadingText,
    rewardLede,
    reward as rewardRegion,
    root,
    step,
    stepDescription,
    stepIcon,
    stepNumber,
    steps,
    stepsGrid,
    stepsLede,
    stepsTitle,
    stepTitle,
    store,
    storeBadge,
    storeBadgeArt,
    storeBadges,
    storeBody,
    storeLede,
    storeQr,
    storeQrCaption,
    storeTitle,
    winWin,
    winWinCard,
    winWinCardAmount,
    winWinCardDescription,
    winWinCardLabel,
    winWinCards,
    winWinLede,
    winWinTitle,
} from "./Ambassador.css";
import { InstallQr } from "./InstallQr";
import { AppStoreBadgeArt, PlayStoreBadgeArt } from "./storeBadges";
import type { AmbassadorProps } from "./types";

type AmbassadorCopy = (typeof componentDefaults)["en"]["ambassador"];

const FRAK_URL = "https://frak.id";

/**
 * SDK config name first, then `og:site_name`, then the bare hostname with a
 * leading `www.` stripped. The replacement runs as a function so `$&` in a
 * merchant's name stays literal instead of reading as a back-reference.
 */
function resolveBrandName(): string {
    return (
        window.FrakSetup?.config?.metadata?.name ||
        document
            .querySelector('meta[property="og:site_name"]')
            ?.getAttribute("content") ||
        window.location.hostname.replace(/^www\./, "")
    );
}

const FIGURE = /^(\D*?)(\d[\d\s.,\u00A0\u202F]*?)(\D*)$/;

/** Draws the currency of a formatted amount smaller; wording without a figure passes through. */
function Figure({ amount }: { amount: string }) {
    const parts = FIGURE.exec(amount);
    if (!parts) {
        return (
            <span class={`${amountWords} frak-ambassador__amount-words`}>
                {amount}
            </span>
        );
    }
    const [, before, figure, after] = parts;
    const unit = (text: string) =>
        text ? (
            <small class={`${amountUnit} frak-ambassador__amount-unit`}>
                {text}
            </small>
        ) : null;
    return (
        <>
            {unit(before)}
            {figure}
            {unit(after)}
        </>
    );
}

function headingText(text: string) {
    return text ? (
        <span
            class={`${rewardHeadingText} frak-ambassador__reward-heading-text`}
        >
            {text}
        </span>
    ) : null;
}

type RewardHeading =
    | { kind: "override"; text: string }
    | { kind: "parts"; before: string; amount: string; after: string };

function resolveFallbackLabel(
    prop: string | undefined,
    defaults: AmbassadorCopy,
    brand: string
): string {
    return prop
        ? prop.replaceAll("{BRAND}", () => brand)
        : defaults.rewardFallbackLabel;
}

/** A `{REWARD}` override with no figure to fill it would read "earn ."; the default copy wins. */
function usableOverride(
    prop: string | undefined,
    amount: string | undefined
): string | undefined {
    // A blank override is honoured: that is how a merchant hides a slot.
    if (prop === undefined) return undefined;
    return amount || !prop.includes("{REWARD}") ? prop : undefined;
}

/**
 * Splits the reward heading around its amount slot so the `h2` always renders
 * as one self-contained sentence: amount token in a span when a reward
 * resolves, the fallback subject in that same span when none does.
 */
function resolveRewardHeading(
    defaults: AmbassadorCopy,
    prop: string | undefined,
    fallbackLabel: string,
    reward: string | undefined,
    brand: string
): RewardHeading {
    const brandize = (text: string) => text.replaceAll("{BRAND}", () => brand);
    const [rewardBefore = "", rewardAfter = ""] =
        defaults.rewardHeadingReward.split("{REWARD}");
    const fallbackStart = defaults.rewardHeadingNoReward.indexOf(
        defaults.rewardFallbackLabel
    );
    const override = usableOverride(prop, reward);
    if (override) {
        return {
            kind: "override",
            text: brandize(applyRewardPlaceholder(override, reward)),
        };
    }
    if (reward) {
        return {
            kind: "parts",
            before: brandize(rewardBefore),
            amount: reward,
            after: brandize(rewardAfter),
        };
    }
    return {
        kind: "parts",
        before: brandize(
            fallbackStart >= 0
                ? defaults.rewardHeadingNoReward.slice(0, fallbackStart)
                : defaults.rewardHeadingNoReward
        ),
        amount: fallbackStart >= 0 ? fallbackLabel : "",
        after: brandize(
            fallbackStart >= 0
                ? defaults.rewardHeadingNoReward.slice(
                      fallbackStart + defaults.rewardFallbackLabel.length
                  )
                : ""
        ),
    };
}

/** A dashboard answer replaces the split one only while no split attribute is set. */
function resolveFaq5Answer(
    dashboardAnswer: string | undefined,
    splitAttributes: (string | undefined)[],
    reward: string | undefined,
    brandize: (text: string) => string
): string | undefined {
    if (splitAttributes.some((value) => value !== undefined)) return undefined;
    const answer = usableOverride(dashboardAnswer, reward);
    return answer === undefined
        ? undefined
        : brandize(applyRewardPlaceholder(answer, reward));
}

/** Closed gate means no pill; a `{REWARD}` override without a figure falls back to the words. */
function resolveHeroPill(
    defaults: AmbassadorCopy,
    prop: string | undefined,
    hasRefereeReward: boolean,
    refereeReward: string | undefined,
    brand: string
): string | null {
    if (!hasRefereeReward) return null;
    const brandize = (text: string) => text.replaceAll("{BRAND}", () => brand);
    const override = usableOverride(prop, refereeReward);
    if (override) {
        return brandize(applyRewardPlaceholder(override, refereeReward));
    }
    return refereeReward
        ? applyRewardPlaceholder(defaults.heroRewardRefereePill, refereeReward)
        : defaults.heroRewardRefereePillNoReward;
}

const DASHBOARD_FIELDS = [
    "heroTitle",
    "heroLede",
    "heroRewardCaption",
    "heroCtaLabel",
    "heroImageUrl",
    "rewardHeading",
    "rewardLede",
    "rewardCtaLabel",
    "referralCtaLabel",
    "faq1Question",
    "faq1Answer",
    "faq2Question",
    "faq2Answer",
    "faq3Question",
    "faq3Answer",
    "faq4Question",
    "faq4Answer",
    "faq5Question",
] as const;

type AmbassadorPageProps = AmbassadorProps & { faq5Answer?: string };

/**
 * Full-page ambassador: hero, reward, explainer, win-win, referral, store, FAQ;
 * `isHidden` alone suppresses it. Theme it with the twenty-two `--frak-amb-*`
 * properties, which outrank the sampled host theme; classes are best-effort.
 *
 * @group components
 * @example `<frak-ambassador></frak-ambassador>`
 */
export function Ambassador(props: AmbassadorProps) {
    const dashboard = useGlobalComponents()?.ambassador;
    const merged: AmbassadorPageProps = {
        ...props,
        faq5Answer: dashboard?.faq5Answer,
    };
    // Attribute first, then the merchant's dashboard setting; defaults apply below.
    for (const field of DASHBOARD_FIELDS) {
        merged[field] = props[field] ?? dashboard?.[field];
    }
    return <AmbassadorPage {...merged} />;
}

function AmbassadorPage({
    merchantId: propMerchantId,
    classname = "",
    heroTitle: propHeroTitle,
    heroEyebrow: propHeroEyebrow,
    heroLede: propHeroLede,
    heroCtaLabel: propHeroCtaLabel,
    heroFacesCaption: propHeroFacesCaption,
    heroImageUrl,
    heroImageAlt: propHeroImageAlt,
    heroRewardCaption: propHeroRewardCaption,
    heroRewardRefereePill: propHeroRewardRefereePill,
    rewardEyebrow: propRewardEyebrow,
    rewardHeading: propRewardHeading,
    rewardEstimateCaption: propRewardEstimateCaption,
    rewardLede: propRewardLede,
    rewardCtaLabel: propRewardCtaLabel,
    rewardFooterCaption: propRewardFooterCaption,
    rewardNoBankDetails: propRewardNoBankDetails,
    rewardFallbackLabel: propRewardFallbackLabel,
    explainerTitle: propExplainerTitle,
    explainerLede: propExplainerLede,
    step1Title: propStep1Title,
    step1Description: propStep1Description,
    step1ImageUrl,
    step1ImageAlt: propStep1ImageAlt,
    step2Title: propStep2Title,
    step2Description: propStep2Description,
    step2ImageUrl,
    step2ImageAlt: propStep2ImageAlt,
    step3Title: propStep3Title,
    step3Description: propStep3Description,
    step3ImageUrl,
    step3ImageAlt: propStep3ImageAlt,
    winWinHeading: propWinWinHeading,
    winWinLede: propWinWinLede,
    winWinCard1Title: propWinWinCard1Title,
    winWinCard1Description: propWinWinCard1Description,
    winWinCard2Title: propWinWinCard2Title,
    winWinCard2Description: propWinWinCard2Description,
    referralHeading: propReferralHeading,
    referralLede: propReferralLede,
    referralCtaLabel: propReferralCtaLabel,
    storeHeading: propStoreHeading,
    storeLede: propStoreLede,
    storeAppBadgeAriaLabel: propStoreAppBadgeAriaLabel,
    storePlayBadgeAriaLabel: propStorePlayBadgeAriaLabel,
    storeQrLabel: propStoreQrLabel,
    storeQrCaption: propStoreQrCaption,
    faqHeading: propFaqHeading,
    faq1Question: propFaq1Question,
    faq1Answer: propFaq1Answer,
    faq2Question: propFaq2Question,
    faq2Answer: propFaq2Answer,
    faq3Question: propFaq3Question,
    faq3Answer: propFaq3Answer,
    faq4Question: propFaq4Question,
    faq4Answer: propFaq4Answer,
    faq5Question: propFaq5Question,
    faq5AnswerBeforeLink: propFaq5AnswerBeforeLink,
    faq5AnswerLinkText: propFaq5AnswerLinkText,
    faq5AnswerAfterLink: propFaq5AnswerAfterLink,
    attributionBeforeLink: propAttributionBeforeLink,
    attributionLinkText: propAttributionLinkText,
    faq5Answer: dashboardFaq5Answer,
}: AmbassadorPageProps) {
    const { isHidden, isClientReady } = useClientReady();
    const lang = useLang();
    const rootRef = useRef<HTMLDivElement>(null);

    useHostTheme(rootRef);

    useLightDomStyles(
        "frak-ambassador",
        undefined,
        undefined,
        cssSource,
        sharedBaseCss
    );

    // The page recruits every visitor, so the headline amount is always the referrer side.
    const { reward } = useReward(isClientReady, undefined, "referrer");
    // One referee gate for every friend-benefit surface; closed while pending or on failure.
    const { reward: refereeReward, hasReward: hasRefereeReward } = useReward(
        isClientReady,
        undefined,
        "referee"
    );

    const [installUrl, setInstallUrl] = useState<string | undefined>(undefined);
    // A merchant image URL can go stale; a collapsed frame beats a broken icon.
    const [failedHeroUrl, setFailedHeroUrl] = useState<string>();

    useEffect(() => {
        let cancelled = false;
        getInstallUrl({ merchantId: propMerchantId })
            .then((url) => {
                if (!cancelled) setInstallUrl(url);
            })
            .catch((error) => console.error("Frak install link failed", error));
        return () => {
            cancelled = true;
        };
    }, [propMerchantId, isClientReady]);

    const handleShare = useCallback(() => {
        if (!isClientReady) return;
        openSharingPage();
    }, [isClientReady]);

    const brand = resolveBrandName();
    // An anchor without href has no link role: keep it focusable and announced until the link lands.
    const inert = installUrl === undefined;

    const texts = useMemo(() => {
        const defaults = componentDefaults[lang].ambassador;
        const brandize = (text: string) =>
            text.replaceAll("{BRAND}", () => brand);
        const resolve = (prop: string | undefined, fallback: string) =>
            brandize(
                applyRewardPlaceholder(
                    usableOverride(prop, reward) ?? fallback,
                    reward
                )
            );

        const fallbackLabel = resolveFallbackLabel(
            propRewardFallbackLabel,
            defaults,
            brand
        );
        const heroAmountText = reward ?? fallbackLabel;
        const rewardHeadingResolved = resolveRewardHeading(
            defaults,
            propRewardHeading,
            fallbackLabel,
            reward,
            brand
        );

        const heroPillText = resolveHeroPill(
            defaults,
            propHeroRewardRefereePill,
            hasRefereeReward,
            refereeReward,
            brand
        );
        // Friend slots fill {REWARD} with the referee amount instead.
        const resolveFriend = (prop: string | undefined, fallback: string) =>
            brandize(
                applyRewardPlaceholder(
                    usableOverride(prop, refereeReward) ?? fallback,
                    refereeReward
                )
            );
        // Merchant overrides of friend-perk slots obey the gate too.
        const gated = (
            prop: string | undefined,
            perk: string,
            plain: string
        ) =>
            hasRefereeReward
                ? resolveFriend(prop, perk)
                : resolve(undefined, plain);

        const steps = [
            {
                title: resolve(propStep1Title, defaults.explainerStep1Title),
                description: resolve(
                    propStep1Description,
                    defaults.explainerStep1Description
                ),
                imageUrl: step1ImageUrl,
                imageAlt: propStep1ImageAlt,
            },
            {
                title: resolve(propStep2Title, defaults.explainerStep2Title),
                description: resolve(
                    propStep2Description,
                    defaults.explainerStep2Description
                ),
                imageUrl: step2ImageUrl,
                imageAlt: propStep2ImageAlt,
            },
            {
                title: resolve(propStep3Title, defaults.explainerStep3Title),
                description: resolve(
                    propStep3Description,
                    defaults.explainerStep3Description
                ),
                imageUrl: step3ImageUrl,
                imageAlt: propStep3ImageAlt,
            },
        ];

        const winWinCards = [
            {
                title: resolve(propWinWinCard1Title, defaults.winWinCard1Title),
                amount: heroAmountText,
                description: resolve(
                    propWinWinCard1Description,
                    defaults.winWinCard1Description
                ),
            },
            {
                title: resolve(propWinWinCard2Title, defaults.winWinCard2Title),
                amount: refereeReward ?? fallbackLabel,
                description: resolveFriend(
                    propWinWinCard2Description,
                    defaults.winWinCard2Description
                ),
            },
        ];

        const faqs = [
            {
                question: resolve(propFaq1Question, defaults.faq1Question),
                answer: resolve(propFaq1Answer, defaults.faq1Answer),
            },
            {
                question: resolve(propFaq2Question, defaults.faq2Question),
                answer: resolve(propFaq2Answer, defaults.faq2Answer),
            },
            {
                question: resolve(propFaq3Question, defaults.faq3Question),
                answer: gated(
                    propFaq3Answer,
                    defaults.faq3Answer,
                    defaults.faq3AnswerNoReward
                ),
            },
            {
                question: resolve(propFaq4Question, defaults.faq4Question),
                answer: resolve(propFaq4Answer, defaults.faq4Answer),
            },
        ];

        return {
            heroEyebrow: resolve(propHeroEyebrow, defaults.heroEyebrow),
            heroTitle: resolve(propHeroTitle, defaults.heroHeadline),
            heroLede: resolve(
                propHeroLede,
                reward ? defaults.heroLedeReward : defaults.heroLede
            ),
            heroCtaLabel: resolve(propHeroCtaLabel, defaults.heroCtaLabel),
            heroFacesCaption: resolve(
                propHeroFacesCaption,
                defaults.heroFacesCaption
            ),
            heroImageAlt: resolve(propHeroImageAlt, defaults.heroImageAlt),
            heroRewardCaption: resolve(
                propHeroRewardCaption,
                defaults.heroRewardCaption
            ),
            heroAmount: heroAmountText,
            heroPill: heroPillText,
            rewardEyebrow: resolve(propRewardEyebrow, defaults.rewardEyebrow),
            rewardHeading: rewardHeadingResolved,
            rewardEstimateCaption: resolve(
                propRewardEstimateCaption,
                defaults.rewardEstimateCaption
            ),
            rewardLede: resolve(propRewardLede, defaults.rewardLede),
            rewardCtaLabel: resolve(
                propRewardCtaLabel,
                defaults.rewardCtaLabel
            ),
            rewardFooterCaption: [
                resolve(propRewardFooterCaption, defaults.rewardFooterCaption),
                resolve(propRewardNoBankDetails, defaults.rewardNoBankDetails),
            ]
                .filter(Boolean)
                .join(" · "),
            explainerTitle: resolve(
                propExplainerTitle,
                defaults.explainerTitle
            ),
            explainerLede: resolve(propExplainerLede, defaults.explainerLede),
            steps,
            showWinWin: hasRefereeReward,
            winWinHeading: resolve(propWinWinHeading, defaults.winWinHeading),
            winWinLede: resolve(propWinWinLede, defaults.winWinLede),
            winWinCards,
            referralHeading: resolve(
                propReferralHeading,
                defaults.referralHeading
            ),
            referralLede: resolve(propReferralLede, defaults.referralLede),
            referralCtaLabel: resolve(
                propReferralCtaLabel,
                defaults.referralCtaLabel
            ),
            storeHeading: resolve(propStoreHeading, defaults.storeHeading),
            storeLede: resolve(propStoreLede, defaults.storeLede),
            storeAppBadgeAriaLabel: resolve(
                propStoreAppBadgeAriaLabel,
                defaults.storeAppBadgeAriaLabel
            ),
            storePlayBadgeAriaLabel: resolve(
                propStorePlayBadgeAriaLabel,
                defaults.storePlayBadgeAriaLabel
            ),
            storeQrLabel: resolve(propStoreQrLabel, defaults.storeQrLabel),
            storeQrCaption: resolve(
                propStoreQrCaption,
                defaults.storeQrCaption
            ),
            faqHeading: resolve(propFaqHeading, defaults.faqHeading),
            faqs,
            faq5Question: resolve(propFaq5Question, defaults.faq5Question),
            faq5Answer: resolveFaq5Answer(
                dashboardFaq5Answer,
                [
                    propFaq5AnswerBeforeLink,
                    propFaq5AnswerLinkText,
                    propFaq5AnswerAfterLink,
                ],
                reward,
                brandize
            ),
            faq5AnswerBeforeLink: resolve(
                propFaq5AnswerBeforeLink,
                defaults.faq5AnswerBeforeLink
            ),
            faq5AnswerLinkText: resolve(
                propFaq5AnswerLinkText,
                defaults.faq5AnswerLinkText
            ),
            faq5AnswerAfterLink: resolve(
                propFaq5AnswerAfterLink,
                defaults.faq5AnswerAfterLink
            ),
            attributionBeforeLink: resolve(
                propAttributionBeforeLink,
                defaults.attributionBeforeLink
            ),
            attributionLinkText: resolve(
                propAttributionLinkText,
                defaults.attributionLinkText
            ),
        };
    }, [
        lang,
        reward,
        refereeReward,
        hasRefereeReward,
        brand,
        propHeroTitle,
        propHeroEyebrow,
        propHeroLede,
        propHeroCtaLabel,
        propHeroFacesCaption,
        propHeroImageAlt,
        propHeroRewardCaption,
        propHeroRewardRefereePill,
        propRewardEyebrow,
        propRewardHeading,
        propRewardEstimateCaption,
        propRewardLede,
        propRewardCtaLabel,
        propRewardFooterCaption,
        propRewardNoBankDetails,
        propRewardFallbackLabel,
        propExplainerTitle,
        propExplainerLede,
        propStep1Title,
        propStep1Description,
        step1ImageUrl,
        propStep1ImageAlt,
        propStep2Title,
        propStep2Description,
        step2ImageUrl,
        propStep2ImageAlt,
        propStep3Title,
        propStep3Description,
        step3ImageUrl,
        propStep3ImageAlt,
        propWinWinHeading,
        propWinWinLede,
        propWinWinCard1Title,
        propWinWinCard1Description,
        propWinWinCard2Title,
        propWinWinCard2Description,
        propReferralHeading,
        propReferralLede,
        propReferralCtaLabel,
        propStoreHeading,
        propStoreLede,
        propStoreAppBadgeAriaLabel,
        propStorePlayBadgeAriaLabel,
        propStoreQrLabel,
        propStoreQrCaption,
        propFaqHeading,
        propFaq1Question,
        propFaq1Answer,
        propFaq2Question,
        propFaq2Answer,
        propFaq3Question,
        propFaq3Answer,
        propFaq4Question,
        propFaq4Answer,
        propFaq5Question,
        propFaq5AnswerBeforeLink,
        propFaq5AnswerLinkText,
        propFaq5AnswerAfterLink,
        propAttributionBeforeLink,
        propAttributionLinkText,
        dashboardFaq5Answer,
    ]);

    if (isHidden) return null;

    const showHeroImage =
        Boolean(heroImageUrl) && heroImageUrl !== failedHeroUrl;

    const rootClass = [root, "frak-ambassador", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <div ref={rootRef} class={rootClass} lang={lang}>
            <section class={`${hero} frak-ambassador__hero`}>
                <div class={`${heroBody} frak-ambassador__hero-body`}>
                    <p class={`${heroEyebrow} frak-ambassador__hero-eyebrow`}>
                        {texts.heroEyebrow}
                    </p>
                    <h1 class={`${heroTitle} frak-ambassador__hero-title`}>
                        {texts.heroTitle}
                    </h1>
                    <p class={`${heroLede} frak-ambassador__hero-lede`}>
                        {texts.heroLede}
                    </p>
                    <button
                        type="button"
                        class={`${heroCta} frak-ambassador__hero-cta`}
                        disabled={!isClientReady}
                        onClick={handleShare}
                    >
                        {texts.heroCtaLabel}
                    </button>
                    <p class={`${heroFaces} frak-ambassador__hero-faces`}>
                        {texts.heroFacesCaption}
                    </p>
                </div>
                <div
                    class={
                        showHeroImage
                            ? `${heroArt} ${heroArtFramed} frak-ambassador__hero-art frak-ambassador__hero-art--framed`
                            : `${heroArt} frak-ambassador__hero-art`
                    }
                >
                    {showHeroImage ? (
                        <img
                            src={heroImageUrl}
                            alt={texts.heroImageAlt}
                            class={`${heroImage} frak-ambassador__hero-image`}
                            onError={() => setFailedHeroUrl(heroImageUrl)}
                        />
                    ) : null}
                    <div class={`${heroTag} frak-ambassador__hero-tag`}>
                        <div
                            class={`${heroTagMain} frak-ambassador__hero-tag-main`}
                        >
                            <b
                                class={`${heroAmount} frak-ambassador__hero-amount`}
                            >
                                {texts.heroAmount}
                            </b>{" "}
                            <small
                                class={`${heroRewardCaption} frak-ambassador__hero-reward-caption`}
                            >
                                {texts.heroRewardCaption}
                            </small>
                        </div>
                        {texts.heroPill ? (
                            <span
                                class={`${heroPill} frak-ambassador__hero-pill`}
                            >
                                {texts.heroPill}
                            </span>
                        ) : null}
                    </div>
                </div>
            </section>

            <section class={`${rewardRegion} frak-ambassador__reward`}>
                <p class={`${rewardEyebrow} frak-ambassador__reward-eyebrow`}>
                    {texts.rewardEyebrow}
                </p>
                <h2 class={`${rewardHeading} frak-ambassador__reward-heading`}>
                    {texts.rewardHeading.kind === "override" ? (
                        headingText(texts.rewardHeading.text)
                    ) : (
                        <>
                            {headingText(texts.rewardHeading.before)}
                            <span
                                class={`${rewardAmount} frak-ambassador__reward-amount`}
                            >
                                <Figure amount={texts.rewardHeading.amount} />
                            </span>
                            {headingText(texts.rewardHeading.after)}
                        </>
                    )}
                </h2>
                <p class={`${rewardCaption} frak-ambassador__reward-caption`}>
                    {texts.rewardEstimateCaption}
                </p>
                <p class={`${rewardLede} frak-ambassador__reward-lede`}>
                    {texts.rewardLede}
                </p>
                <button
                    type="button"
                    class={`${rewardCta} frak-ambassador__reward-cta`}
                    disabled={!isClientReady}
                    onClick={handleShare}
                >
                    {texts.rewardCtaLabel}
                </button>
                <p class={`${rewardFooter} frak-ambassador__reward-footer`}>
                    {texts.rewardFooterCaption}
                </p>
            </section>

            <section class={`${steps} frak-ambassador__steps`}>
                <h2 class={`${stepsTitle} frak-ambassador__steps-title`}>
                    {texts.explainerTitle}
                </h2>
                <p class={`${stepsLede} frak-ambassador__steps-lede`}>
                    {texts.explainerLede}
                </p>
                <div class={`${stepsGrid} frak-ambassador__steps-grid`}>
                    {texts.steps.map(
                        ({ title, description, imageUrl, imageAlt }, index) => (
                            <div
                                key={title}
                                class={`${step} frak-ambassador__step`}
                            >
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={imageAlt ?? title}
                                        class={`${stepIcon} frak-ambassador__step-icon`}
                                    />
                                ) : (
                                    <p
                                        class={`${stepNumber} frak-ambassador__step-number`}
                                        aria-hidden="true"
                                    >
                                        {index + 1}
                                    </p>
                                )}
                                <h3
                                    class={`${stepTitle} frak-ambassador__step-title`}
                                >
                                    {title}
                                </h3>
                                <p
                                    class={`${stepDescription} frak-ambassador__step-description`}
                                >
                                    {description}
                                </p>
                            </div>
                        )
                    )}
                </div>
            </section>

            {texts.showWinWin ? (
                <section class={`${winWin} frak-ambassador__win-win`}>
                    <h2 class={`${winWinTitle} frak-ambassador__win-win-title`}>
                        {texts.winWinHeading}
                    </h2>
                    <p class={`${winWinLede} frak-ambassador__win-win-lede`}>
                        {texts.winWinLede}
                    </p>
                    <div
                        class={`${winWinCards} frak-ambassador__win-win-cards`}
                    >
                        {texts.winWinCards.map(
                            ({ title, amount, description }) => (
                                <div
                                    key={title}
                                    class={`${winWinCard} frak-ambassador__win-win-card`}
                                >
                                    <p
                                        class={`${winWinCardLabel} frak-ambassador__win-win-card-label`}
                                    >
                                        {title}
                                    </p>
                                    <p
                                        class={`${winWinCardAmount} frak-ambassador__win-win-card-amount`}
                                    >
                                        <Figure amount={amount} />
                                    </p>
                                    <p
                                        class={`${winWinCardDescription} frak-ambassador__win-win-card-description`}
                                    >
                                        {description}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </section>
            ) : null}

            <section class={`${referral} frak-ambassador__referral`}>
                <h2 class={`${referralTitle} frak-ambassador__referral-title`}>
                    {texts.referralHeading}
                </h2>
                <p class={`${referralLede} frak-ambassador__referral-lede`}>
                    {texts.referralLede}
                </p>
                <button
                    type="button"
                    class={`${referralCta} frak-ambassador__referral-cta`}
                    disabled={!isClientReady}
                    onClick={handleShare}
                >
                    {texts.referralCtaLabel}
                </button>
            </section>

            <section class={`${store} frak-ambassador__store`}>
                <div class={`${storeBody} frak-ambassador__store-body`}>
                    <h2 class={`${storeTitle} frak-ambassador__store-title`}>
                        {texts.storeHeading}
                    </h2>
                    <p class={`${storeLede} frak-ambassador__store-lede`}>
                        {texts.storeLede}
                    </p>
                    <div class={`${storeBadges} frak-ambassador__store-badges`}>
                        <a
                            class={`${storeBadge} frak-ambassador__store-badge frak-ambassador__store-badge--app`}
                            aria-label={texts.storeAppBadgeAriaLabel}
                            href={installUrl}
                            role={inert ? "link" : undefined}
                            tabIndex={inert ? 0 : undefined}
                            aria-disabled={inert ? "true" : undefined}
                        >
                            <AppStoreBadgeArt
                                lang={lang}
                                class={`${storeBadgeArt} frak-ambassador__store-badge-art`}
                            />
                        </a>
                        <a
                            class={`${storeBadge} frak-ambassador__store-badge frak-ambassador__store-badge--play`}
                            aria-label={texts.storePlayBadgeAriaLabel}
                            href={installUrl}
                            role={inert ? "link" : undefined}
                            tabIndex={inert ? 0 : undefined}
                            aria-disabled={inert ? "true" : undefined}
                        >
                            <PlayStoreBadgeArt
                                lang={lang}
                                class={`${storeBadgeArt} frak-ambassador__store-badge-art`}
                            />
                        </a>
                    </div>
                </div>
                <InstallQr
                    url={installUrl}
                    label={texts.storeQrLabel}
                    caption={texts.storeQrCaption}
                    class={`${storeQr} frak-ambassador__store-qr`}
                    captionClass={`${storeQrCaption} frak-ambassador__store-qr-caption`}
                />
            </section>

            <section class={`${faq} frak-ambassador__faq`}>
                <h2 class={`${faqTitle} frak-ambassador__faq-title`}>
                    {texts.faqHeading}
                </h2>
                {texts.faqs.map((entry, index) => (
                    <details
                        key={entry.question}
                        class={`${faqItem} frak-ambassador__faq-item`}
                        open={index === 0}
                    >
                        <summary
                            class={`${faqQuestion} frak-ambassador__faq-question`}
                        >
                            {entry.question}
                        </summary>
                        <p class={`${faqAnswer} frak-ambassador__faq-answer`}>
                            {entry.answer}
                        </p>
                    </details>
                ))}
                <details class={`${faqItem} frak-ambassador__faq-item`}>
                    <summary
                        class={`${faqQuestion} frak-ambassador__faq-question`}
                    >
                        {texts.faq5Question}
                    </summary>
                    <p class={`${faqAnswer} frak-ambassador__faq-answer`}>
                        {texts.faq5Answer ?? (
                            <>
                                {texts.faq5AnswerBeforeLink}
                                <a
                                    class={`${frakLink} frak-ambassador__faq-answer-link frak-link`}
                                    href={FRAK_URL}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {texts.faq5AnswerLinkText}
                                </a>
                                {texts.faq5AnswerAfterLink}
                            </>
                        )}
                    </p>
                </details>
                <p class={`${faqAttribution} frak-ambassador__faq-attribution`}>
                    {texts.attributionBeforeLink}
                    <a
                        class={`${frakLink} frak-link`}
                        href={FRAK_URL}
                        target="_blank"
                        rel="noopener"
                    >
                        <strong>{texts.attributionLinkText}</strong>
                    </a>
                </p>
            </section>
        </div>
    );
}
