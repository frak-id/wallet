import { isInAppBrowser, redirectToExternalBrowser } from "@frak-labs/core-sdk";
import {
    getMergeToken,
    REFERRAL_SUCCESS_EVENT,
} from "@frak-labs/core-sdk/actions";
import { InAppBanner } from "@frak-labs/design-system/components/InAppBanner";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { GiftIcon } from "../icons/GiftIcon";
import {
    cssSource,
    iconSvg,
    referral,
    referralBody,
    referralCta,
    referralDescription,
    referralIconWrapper,
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
    preview,
    previewMode,
}: BannerProps) {
    const isPreview = !!preview;
    const resolvedPreviewMode: BannerMode =
        previewMode === "inapp" ? "inapp" : "referral";
    const placement = usePlacement(placementId);
    const { shouldRender, isHidden, isClientReady } = useClientReady();

    useLightDomStyles(
        "frak-banner",
        placementId,
        placement?.components?.banner?.css,
        cssSource
    );

    const [dismissed, setDismissed] = useState(false);
    const [mode, setMode] = useState<BannerMode | null>(() => {
        if (isPreview) return resolvedPreviewMode;
        return isInAppBrowser ? "inapp" : null;
    });

    // Sync preview mode changes from theme editor
    useEffect(() => {
        if (isPreview) {
            setMode(resolvedPreviewMode);
        }
    }, [isPreview, resolvedPreviewMode]);

    // Fetch reward text the same way ButtonShare does
    const { reward } = useReward(
        mode === "referral" && isClientReady,
        interaction
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
    }, [isPreview, mode, prefetchedMergeToken]);

    const handleDismiss = useCallback(() => {
        if (isPreview) return;
        setDismissed(true);
    }, [isPreview]);

    const bannerConfig = placement?.components?.banner;

    // Resolve texts from placement config with hardcoded defaults
    const texts = useMemo(() => {
        if (mode === "referral") {
            const defaultTitle = reward
                ? `Earn ${reward} on purchases on this site`
                : "You've been referred!";

            return {
                title:
                    propReferralTitle ??
                    bannerConfig?.referralTitle ??
                    defaultTitle,
                description:
                    propReferralDescription ??
                    bannerConfig?.referralDescription ??
                    "Earn rewards after your purchase via the Frak partner app.",
                cta: propReferralCta ?? bannerConfig?.referralCta ?? "Got it",
            };
        }

        return {
            title:
                propInappTitle ??
                bannerConfig?.inappTitle ??
                "Open in your browser",
            description:
                propInappDescription ??
                bannerConfig?.inappDescription ??
                "For a better experience and to earn your rewards, open this page in your default browser.",
            cta: propInappCta ?? bannerConfig?.inappCta ?? "Open browser",
        };
    }, [
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
                dismissLabel="Dismiss"
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
                <GiftIcon class={iconSvg} />
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
        </div>
    );
}
