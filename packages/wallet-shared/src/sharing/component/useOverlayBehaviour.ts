import { type RefObject, useEffect, useRef } from "react";

/** Everything focusable, minus anything explicitly taken out of the tab order. */
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Skips anything inside a `[hidden]` subtree — the FAQ accordion keeps its closed
 * panels mounted. Not an `offsetParent`/rect check: those are meaningless in jsdom.
 */
function focusableWithin(container: HTMLElement): HTMLElement[] {
    return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((element) => element.closest("[hidden]") === null);
}

/**
 * Keep Tab inside the dialog: wrap at both ends, and pull focus back in if it
 * has somehow left the container entirely.
 */
function trapTab(event: KeyboardEvent, container: HTMLElement) {
    const focusable = focusableWithin(container);
    if (focusable.length === 0) {
        // Nothing to cycle through: keep focus on the dialog.
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // The container itself holds focus on open, and sits before `first`.
    const leaving = event.shiftKey
        ? active === first ||
          active === container ||
          !container.contains(active)
        : active === last;

    if (!leaving) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
}

/** Built outside the effect that installs it, to stay under the complexity limit. */
function overlayKeyHandler(
    onDismiss: () => void,
    container: HTMLElement | null
) {
    return (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            onDismiss();
            return;
        }
        if (event.key === "Tab" && container) trapTab(event, container);
    };
}

/**
 * Modal behaviour for an overlay: Escape dismisses, focus starts on the dialog, Tab
 * cannot leave. Listens on `document`; disabled when a host owns the chrome. `onDismiss`
 * is read through a ref so the effect runs once per `enabled` transition.
 */
export function useOverlayBehaviour({
    enabled,
    onDismiss,
    containerRef,
}: {
    enabled: boolean;
    onDismiss: () => void;
    containerRef: RefObject<HTMLElement | null>;
}) {
    const onDismissRef = useRef(onDismiss);
    useEffect(() => {
        onDismissRef.current = onDismiss;
    });

    useEffect(() => {
        if (!enabled) return;

        const container = containerRef.current;

        // Focus the dialog, never its first control: a merchant CTA is clicked
        // with a mouse, so focusing a button matches `:focus-visible` and paints
        // a ring the user never asked for. The container is `tabIndex={-1}` and
        // has its outline suppressed, so it takes focus silently.
        container?.focus({ preventScroll: true });

        const onKeyDown = overlayKeyHandler(
            () => onDismissRef.current(),
            container
        );

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [enabled, containerRef]);
}
