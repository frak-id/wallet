import { useClientReady } from "@/hooks/useClientReady";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { openFrakWalletApp } from "@/utils/openInApp";
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
 * With login action:
 * ```html
 * <frak-open-in-app classname="button button-primary"></frak-open-in-app>
 * ```
 */
export function OpenInAppButton({
    placement: placementId,
    text = "Open in App",
    classname = "",
}: OpenInAppButtonProps) {
    const placement = usePlacement(placementId);
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const { isMobile } = useIsMobile();

    useLightDomStyles(
        "frak-open-in-app",
        placementId,
        placement?.components?.openInApp?.css
    );

    const resolvedText = placement?.components?.openInApp?.text ?? text;

    if (!isMobile || !shouldRender || isHidden) {
        return null;
    }

    const handleClick = () => {
        openFrakWalletApp();
    };

    const buttonClass = ["button", "button__fadeIn", classname]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            aria-label="Open in Frak Wallet app"
            disabled={!isClientReady}
            class={buttonClass}
            onClick={handleClick}
        >
            {resolvedText}
        </button>
    );
}
