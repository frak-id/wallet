import { type RefObject, useEffect, useRef } from "react";

/** Everything focusable, minus anything explicitly taken out of the tab order. */
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Skips anything inside a `[hidden]` subtree — the FAQ accordion keeps its
 * closed panels mounted and hidden, and their links would otherwise be tab
 * stops the user cannot see.
 *
 * Deliberately not an `offsetParent`/`getBoundingClientRect` visibility check:
 * jsdom gives every element a null `offsetParent` and a zero-size rect, so such
 * a filter reports "nothing is focusable" under test while behaving completely
 * differently in a browser — which is exactly the kind of divergence that lets
 * a broken focus trap ship green.
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
        // Nothing to cycle through: keep focus on the dialog rather than
        // letting it escape to the page behind.
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const leaving = event.shiftKey
        ? active === first || !container.contains(active)
        : active === last;

    if (!leaving) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
}

/**
 * Built outside the effect that installs it: nesting these branches inside the
 * effect's own closure pushes the function past the repo's
 * cognitive-complexity limit for no readability gain.
 */
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
 * Modal behaviour for an overlay: Escape dismisses, focus starts inside, and
 * Tab cannot leave.
 *
 * Listens on `document` rather than on the overlay nodes. The backdrop is a
 * non-focusable `div`, so it never received a `keydown` of its own, and the
 * container used to stop every keydown from propagating past it — between them
 * the Escape handler these screens carried was unreachable from the moment it
 * was written.
 *
 * `enabled` is false when a host owns the chrome: it presents this page inside
 * its own sheet, with its own dismiss affordance and its own focus scope, so a
 * second Escape handler and a competing focus trap would fight it.
 *
 * `onDismiss` is read through a ref rather than listed as a dependency. Every
 * consumer builds its outcome handlers as inline closures, so the function is a
 * new identity on each render; depending on it directly would tear down and
 * reinstall the listener — and, worse, re-run the focus move — on every
 * unrelated re-render (the reward query resolving, a product being selected, a
 * share starting). That would yank keyboard focus back to the first control
 * mid-interaction, which is worse for a keyboard or screen-reader user than no
 * focus management at all. The effect therefore runs once per `enabled`
 * transition, which is the actual lifecycle it models.
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

        // Move focus in, so the first Tab lands inside the dialog and a screen
        // reader announces it. Falls back to the container itself, which
        // carries `tabIndex={-1}` for exactly this case.
        if (container) {
            const [first] = focusableWithin(container);
            (first ?? container).focus({ preventScroll: true });
        }

        const onKeyDown = overlayKeyHandler(
            () => onDismissRef.current(),
            container
        );

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [enabled, containerRef]);
}
