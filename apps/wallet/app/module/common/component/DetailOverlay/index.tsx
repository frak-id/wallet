import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnimatedClose } from "@/module/common/hook/useAnimatedClose";
import * as styles from "@/module/common/styles/detailOverlay.css";

type DetailOverlayVariant = "fullScreen" | "bottomSheet";

type DetailOverlayProps = {
    onClose: () => void;
    children: (props: { handleClose: () => void }) => ReactNode;
    /**
     * `"fullScreen"` (default): mobile fills the viewport edge-to-edge,
     * desktop centres the content as a card over a dark backdrop.
     *
     * `"bottomSheet"`: mobile shows a dark backdrop with the sheet
     * bottom-anchored and top-rounded so the backdrop is visible above it.
     * Desktop falls back to the same centred-card layout.
     *
     * IMPORTANT — both variants style the **direct child** of the overlay
     * (rounded corners, max-height, etc.). Render exactly one element from
     * the `children` render-prop; fragments or multiple siblings break the
     * `> *` rules in `detailOverlay.css.ts`. Layered modals should portal
     * elsewhere (e.g. `ResponsiveModal` portals to `document.body`).
     */
    variant?: DetailOverlayVariant;
    /**
     * i18n key resolved to the dialog's accessible name. Resolved here rather
     * than passed pre-translated so the hook-free `renderModal` switch in
     * `ModalOutlet` does not need a translation hook.
     */
    labelKey: DefaultTranslationKey;
};

/**
 * Generic full-screen overlay wrapper for detail sheets.
 *
 * Portals its content to `document.body` with a fade-in/out animation.
 * Exposes `handleClose` via render-prop so children can trigger the
 * closing animation (which calls `onClose` once the animation ends).
 *
 * Render the overlay's body as a single element (see `variant`'s note on
 * the direct-child constraint).
 */
export function DetailOverlay({
    onClose,
    children,
    variant = "fullScreen",
    labelKey,
}: DetailOverlayProps) {
    const { t } = useTranslation();
    const { isClosing, overlayRef, handleClose } = useAnimatedClose(onClose);
    const closeRef = useRef(handleClose);
    closeRef.current = handleClose;

    // Move focus into the dialog on open and hand it back to the trigger on
    // close, so keyboard and screen-reader users are not left on the inert
    // page behind the overlay.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        overlayRef.current?.focus();
        return () => previouslyFocused?.focus?.();
    }, [overlayRef]);

    // Escape closes. Bound to the document rather than the overlay because the
    // overlay only receives key events while focus is inside it, and focus can
    // legitimately sit on a portalled child (e.g. a nested popover).
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // A nested Radix layer (e.g. the Monerium transfer-success dialog
            // inside MoneriumBankFlow) handles Escape on the capture phase and
            // calls `preventDefault`. Without this guard the same keypress
            // would dismiss the inner dialog *and* collapse the whole overlay.
            if (event.defaultPrevented) return;
            // Guard against IME: Escape cancels composition, it should not
            // also close the dialog.
            if (event.isComposing) return;
            closeRef.current();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const className =
        variant === "bottomSheet"
            ? isClosing
                ? styles.bottomSheetClosing
                : styles.bottomSheetOverlay
            : isClosing
              ? styles.overlayClosing
              : styles.overlay;

    return createPortal(
        <div
            ref={overlayRef}
            className={className}
            role="dialog"
            aria-modal="true"
            aria-label={t(labelKey)}
            tabIndex={-1}
        >
            {children({ handleClose })}
        </div>,
        document.body
    );
}
