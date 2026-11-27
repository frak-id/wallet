import { openFrakWalletApp } from "@/actions/openInApp";
import { useClientReady } from "@/hooks/useClientReady";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLang } from "@/hooks/useLang";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { openInAppCopy } from "@/i18n/openInApp";
import type { OpenInAppButtonProps } from "./types";

/**
 * Button to open the Frak Wallet mobile app via deep link
 *
 * @param args
 * @returns The open in app button with `<button>` tag (only renders on mobile devices)
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-open-in-app></frak-open-in-app>
 * ```
 *
 * @example
 * Using a custom text:
 * ```html
 * <frak-open-in-app text="Get the App"></frak-open-in-app>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-open-in-app classname="button button-primary"></frak-open-in-app>
 * ```
 */
export function OpenInAppButton({
    placement: placementId,
    text,
    classname = "",
}: OpenInAppButtonProps) {
    const lang = useLang();
    const placement = usePlacement(placementId);
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { isMobile } = useIsMobile();

    useLightDomStyles(
        "frak-open-in-app",
        placementId,
        placement?.components?.openInApp?.css
    );

    const resolvedText =
        placement?.components?.openInApp?.text ??
        text ??
        openInAppCopy[lang].text;

    if (!isMobile || !shouldRender || isHidden) {
        return null;
    }

    const handleClick = () => {
        openFrakWalletApp(undefined, placementId);
    };

    const buttonClass = ["button", "button__fadeIn", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            aria-label={openInAppCopy[lang].ariaLabel}
            disabled={!isClientReady}
            class={buttonClass}
            onClick={handleClick}
        >
            {resolvedText}
        </button>
    );
}
