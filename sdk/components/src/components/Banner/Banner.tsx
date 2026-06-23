import {
    isInAppBrowser,
    redirectToExternalBrowser,
    trackEvent,
} from "@frak-labs/core-sdk";
import {
    getMergeToken,
    REFERRAL_SUCCESS_EVENT,
} from "@frak-labs/core-sdk/actions";
import { InAppBanner } from "@frak-labs/design-system/components/InAppBanner";
import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLang } from "@/hooks/useLang";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { componentDefaults } from "@/i18n/defaults";
import { cssSource as sharedBaseCss } from "@/styles/sharedBaseCss.css";
import { applyRewardPlaceholder } from "@/utils/format/formatReward";
import { GiftIcon } from "../icons/GiftIcon";
import {
    cssSource,
    frakLogo,
    iconSvg,
    referral,
    referralBody,
    referralCta,
    referralDescription,
    referralIconWrapper,
    referralImage,
    referralTitle,
} from "./Banner.css";
import type { BannerProps } from "./types";

type BannerMode = "referral" | "inapp";

/**
 * Auto-detecting notification banner component.
 *
 * Renders an inline banner on the merchant page with one of two distinct
 * visual styles depending on the detected mode:
 *
 * - **Referral mode** (white): Shown after a successful referral link
 *   processing. Displays a gift icon, reward copy, and a "Got it" CTA.
 * - **In-app browser mode** (dark transparent): Shown when the page is
 *   opened inside a social media in-app browser (Instagram, Facebook).
 *   Offers an inline link to redirect to the default browser plus a
 *   close button to dismiss.
 *
 * In-app browser mode takes priority over referral mode.
 * Uses Light DOM + vanilla-extract styles from `@frak-labs/design-system`.
 *
 * @group components
 *
 * @example
 * Basic usage (auto-detects mode):
 * ```html
 * <frak-banner></frak-banner>
 * ```
 *
 * @example
 * With a custom class:
 * ```html
 * <frak-banner classname="my-custom-banner"></frak-banner>
 * ```
 */
export function Banner({
    placement: placementId,
    classname = "",
    interaction,
    referralTitle: propReferralTitle,
    referralDescription: propReferralDescription,
    referralCta: propReferralCta,
    inappTitle: propInappTitle,
    inappDescription: propInappDescription,
    inappCta: propInappCta,
    imageUrl,
    preview,
    previewMode,
    allowInappRedirect,
}: BannerProps) {
    const isPreview = !!preview;
    const lang = useLang();
    const resolvedPreviewMode: BannerMode =
        previewMode === "inapp" ? "inapp" : "referral";
    // HTML attribute consumers (Shopify Liquid, WordPress PHP) pass
    // strings, so allow `"true"` alongside the JSX boolean `true`.
    const isInappRedirectAllowed =
        allowInappRedirect === true || allowInappRedirect === "true";
    const placement = usePlacement(placementId);
    const { shouldRender, isHidden, isClientReady } = useClientReady();

    useLightDomStyles(
        "frak-banner",
        placementId,
        placement?.components?.banner?.css,
        cssSource,
        sharedBaseCss
    );

    const [dismissed, setDismissed] = useState(false);
    const [mode, setMode] = useState<BannerMode | null>(() => {
        if (isPreview) return resolvedPreviewMode;
        return isInappRedirectAllowed && isInAppBrowser ? "inapp" : null;
    });

    // Emit a single impression per (mount, mode) pair. A user who sees the
    // referral banner and the in-app banner in the same session produces
    // two impressions — which is the desired funnel granularity. Ref instead
    // of state to avoid triggering a re-render on each fire.
    const trackedImpressionModeRef = useRef<BannerMode | null>(null);

    // Sync preview mode changes from theme editor
    useEffect(() => {
        if (isPreview) {
            setMode(resolvedPreviewMode);
        }
    }, [isPreview, resolvedPreviewMode]);

    // Fetch reward text the same way ButtonShare does — but for the *referee*
    // side: the referral banner is shown to a freshly-referred user, so it must
    // advertise what they earn on their purchases, not the sharer's reward.
    const { reward } = useReward(
        mode === "referral" && isClientReady,
        interaction,
        "referee"
    );

    // Pre-fetch merge token when in inapp mode so the click is instant
    const [prefetchedMergeToken, setPrefetchedMergeToken] = useState<
        string | null
    >(null);
    useEffect(() => {
        const client = window.FrakSetup?.client;
        if (mode !== "inapp" || isPreview || !isClientReady || !client) return;

        getMergeToken(client)
            .then((token) => setPrefetchedMergeToken(token))
            .catch(() => {});
    }, [mode, isPreview, isClientReady]);

    useEffect(() => {
        if (isPreview || !mode || dismissed) return;
        if (trackedImpressionModeRef.current === mode) return;
        if (!isClientReady) return;
        trackEvent(window.FrakSetup?.client, "banner_impression", {
            placement: placementId,
            variant: mode,
            has_reward: mode === "referral" ? Boolean(reward) : undefined,
        });
        trackedImpressionModeRef.current = mode;
        // `reward` is intentionally omitted — async arrival would produce
        // a second impression event.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, dismissed, isClientReady, isPreview, placementId]);

    // Listen for the referral success event (only when not in preview or in-app browser mode)
    useEffect(() => {
        if (isPreview || mode === "inapp") return;

        const handler = () => setMode("referral");

        window.addEventListener(REFERRAL_SUCCESS_EVENT, handler);
        return () =>
            window.removeEventListener(REFERRAL_SUCCESS_EVENT, handler);
    }, [isPreview, mode]);

    const handleAction = useCallback(async () => {
        if (isPreview) return;
        trackEvent(window.FrakSetup?.client, "banner_resolved", {
            placement: placementId,
            variant: mode ?? "referral",
            outcome: "clicked",
        });
        if (mode === "referral") {
            setDismissed(true);
            return;
        }

        let mergeToken = prefetchedMergeToken;
        if (!mergeToken && window.FrakSetup?.client) {
            try {
                mergeToken = await getMergeToken(window.FrakSetup?.client);
            } catch {
                // Client not ready or request failed — redirect without token
            }
        }

        let targetUrl = window.location.href;
        if (mergeToken) {
            const url = new URL(targetUrl);
            url.searchParams.set("fmt", mergeToken);
            targetUrl = url.toString();
        }

        redirectToExternalBrowser(targetUrl);
    }, [isPreview, mode, prefetchedMergeToken, placementId]);

    const handleDismiss = useCallback(() => {
        if (isPreview) return;
        trackEvent(window.FrakSetup?.client, "banner_resolved", {
            placement: placementId,
            variant: mode ?? "referral",
            outcome: "dismissed",
        });
        setDismissed(true);
    }, [isPreview, mode, placementId]);

    const globalComponents = useGlobalComponents();
    const bannerConfig =
        placement?.components?.banner ?? globalComponents?.banner;

    // Resolve texts from placement config with hardcoded defaults.
    // Configured wording may carry the `{REWARD}` token — interpolate it the
    // same way ButtonShare and PostPurchase do.
    const texts = useMemo(() => {
        const defaults = componentDefaults[lang].banner;
        if (mode === "referral") {
            const defaultTitle = reward
                ? defaults.referralTitleReward
                : defaults.referralTitle;

            return {
                title: applyRewardPlaceholder(
                    propReferralTitle ??
                        bannerConfig?.referralTitle ??
                        defaultTitle,
                    reward
                ),
                description: applyRewardPlaceholder(
                    propReferralDescription ??
                        bannerConfig?.referralDescription ??
                        defaults.referralDescription,
                    reward
                ),
                cta:
                    propReferralCta ??
                    bannerConfig?.referralCta ??
                    defaults.referralCta,
            };
        }

        // In-app mode never resolves a reward (only referral mode fetches one),
        // so the copy is rendered verbatim — no `{REWARD}` interpolation.
        return {
            title:
                propInappTitle ??
                bannerConfig?.inappTitle ??
                defaults.inappTitle,
            description:
                propInappDescription ??
                bannerConfig?.inappDescription ??
                defaults.inappDescription,
            cta: propInappCta ?? bannerConfig?.inappCta ?? defaults.inappCta,
        };
    }, [
        lang,
        mode,
        reward,
        bannerConfig,
        propReferralTitle,
        propReferralDescription,
        propReferralCta,
        propInappTitle,
        propInappDescription,
        propInappCta,
    ]);

    if (!mode || (!isPreview && (!shouldRender || isHidden || dismissed))) {
        return null;
    }

    // Keep literal BEM classes alongside vanilla-extract hashed classes so
    // external tests / merchant selectors targeting `.frak-banner*` keep
    // working while the visual styling is driven by the design system.
    const bannerClass = [
        referral,
        "frak-banner",
        `frak-banner--${mode}`,
        classname,
    ]
        .filter(Boolean)
        .join(" ");

    if (mode === "inapp") {
        return (
            <InAppBanner
                title={texts.title}
                description={texts.description}
                cta={texts.cta}
                dismissLabel={componentDefaults[lang].banner.dismissLabel}
                onAction={handleAction}
                onDismiss={handleDismiss}
                className={["frak-banner", "frak-banner--inapp", classname]
                    .filter(Boolean)
                    .join(" ")}
                classNames={{
                    icon: "frak-banner__icon",
                    title: "frak-banner__title",
                    description: "frak-banner__description",
                    cta: "frak-banner__cta",
                    close: "frak-banner__close",
                }}
            />
        );
    }

    return (
        <div class={bannerClass} role="alert">
            <div class={`${referralIconWrapper} frak-banner__icon`}>
                {imageUrl ? (
                    <img src={imageUrl} alt="" class={referralImage} />
                ) : (
                    <GiftIcon class={iconSvg} />
                )}
            </div>
            <div class={`${referralBody} frak-banner__text`}>
                <p class={`${referralTitle} frak-banner__title`}>
                    {texts.title}
                </p>
                <p class={`${referralDescription} frak-banner__description`}>
                    {texts.description}
                </p>
                <button
                    type="button"
                    class={`${referralCta} frak-banner__cta`}
                    onClick={handleAction}
                >
                    {texts.cta}
                </button>
            </div>
            <LogoFrakWithName
                class={`${frakLogo} frak-banner__logo`}
                width={42}
                height={24}
            />
        </div>
    );
}
