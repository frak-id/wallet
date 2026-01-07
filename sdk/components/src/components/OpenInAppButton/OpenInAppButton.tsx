import { cx } from "class-variance-authority";
import { Spinner } from "@/components/Spinner";
import { useClientReady } from "@/hooks/useClientReady";
import { useIsMobile } from "@/hooks/useIsMobile";
import { openFrakWalletApp } from "@/utils/openInApp";
import styles from "./OpenInAppButton.module.css";
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
    text = "Open in App",
    classname = "",
}: OpenInAppButtonProps) {
    const { isClientReady } = useClientReady();
    const { isMobile } = useIsMobile();

    if (!isMobile) {
        return null;
    }

    return (
        <button
            type="button"
            aria-label="Open in Frak Wallet app"
            className={cx(styles.button, classname, "override")}
            disabled={!isClientReady}
            onClick={() => openFrakWalletApp()}
        >
            {!isClientReady && <Spinner />} {text}
        </button>
    );
}
