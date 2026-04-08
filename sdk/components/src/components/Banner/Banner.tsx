import { isInAppBrowser, redirectToExternalBrowser } from "@frak-labs/core-sdk";
import { REFERRAL_SUCCESS_EVENT } from "@frak-labs/core-sdk/actions";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { useReward } from "@/hooks/useReward";
import { bannerBaseCss } from "@/utils/sharedCss";
import type { BannerProps } from "./types";

type BannerMode = "referral" | "inapp";

/**
 * Reward/gift icon for referral mode.
 */
function RewardIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <rect x="3" y="11" width="18" height="11" rx="1" />
            <path d="M12 11v11" />
            <rect x="5" y="7" width="14" height="4" rx="1" />
            <path d="M12 7c0 0-1.5-4-4.5-4S5 5 7.5 7" />
            <path d="M12 7c0 0 1.5-4 4.5-4S19 5 16.5 7" />
        </svg>
    );
}

/**
 * External link icon for in-app browser mode.
 */
function BrowserIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

/**
 * Auto-detecting notification banner component.
 *
 * Renders an inline banner on the merchant page that auto-detects which
 * message to display:
 *
 * - **Referral mode**: Shown after successful referral link processing.
 *   Displays reward info and a dismiss button ("Got it").
 * - **In-app browser mode**: Shown when the page is opened inside a social
 *   media in-app browser (Instagram, Facebook). Offers a redirect to the
 *   default browser.
 *
 * In-app browser mode takes priority over referral mode.
 * Uses Light DOM to inherit merchant page styles.
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
}: BannerProps) {
    const placement = usePlacement(placementId);
    const { shouldRender, isHidden, isClientReady } = useClientReady();

    useLightDomStyles(
        "frak-banner",
        placementId,
        placement?.components?.banner?.css,
        bannerBaseCss
    );

    const [dismissed, setDismissed] = useState(false);
    const [mode, setMode] = useState<BannerMode | null>(() =>
        isInAppBrowser ? "inapp" : null
    );

    // Fetch reward text the same way ButtonShare does
    const { reward } = useReward(
        mode === "referral" && isClientReady,
        interaction
    );

    // Listen for the referral success event (only when not in in-app browser mode)
    useEffect(() => {
        if (mode === "inapp") return;

        const handler = () => setMode("referral");

        window.addEventListener(REFERRAL_SUCCESS_EVENT, handler);
        return () =>
            window.removeEventListener(REFERRAL_SUCCESS_EVENT, handler);
    }, [mode]);

    const handleAction = useCallback(() => {
        if (mode === "referral") {
            setDismissed(true);
        } else {
            redirectToExternalBrowser(window.location.href);
        }
    }, [mode]);

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

    if (!shouldRender || isHidden || dismissed || !mode) {
        return null;
    }

    const bannerClass = ["banner", "banner__fadeIn", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <div class={bannerClass} role="alert">
            <div class="banner__icon">
                {mode === "referral" ? <RewardIcon /> : <BrowserIcon />}
            </div>
            <div class="banner__content">
                <p class="banner__title">{texts.title}</p>
                <p class="banner__description">{texts.description}</p>
            </div>
            <button type="button" class="banner__cta" onClick={handleAction}>
                {texts.cta}
            </button>
        </div>
    );
}
