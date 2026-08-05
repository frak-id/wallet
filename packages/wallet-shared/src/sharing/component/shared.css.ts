import { tablet } from "@frak-labs/design-system/breakpoints";
import { hostSheetTopRadius } from "@frak-labs/design-system/hostSheet";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, type StyleRule, style } from "@vanilla-extract/css";

/**
 * Shared responsive container styles for tablet+.
 * Turns the full-viewport layout into a centered card.
 */
export const tabletContainerMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        height: "auto",
        maxWidth: "560px",
        maxHeight: "90dvh",
        margin: "auto",
        borderRadius: alias.cornerRadius.xl,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
    },
};

/**
 * Container variant for a host that presents this page inside its own sheet.
 *
 * Cancels the `tabletContainerMedia` card treatment; the opaque background
 * from `container` stays so the page's surface fills the host sheet.
 *
 * Rounds the two top corners to the host's own radius. That rounding is drawn
 * here rather than by the host because an Android `WebView` draws through a GPU
 * functor that cannot be handed a round-rect clip — HWUI answers a non-rect
 * clip with a per-frame stencil pass around every functor draw. The radius
 * arrives as a custom property the host injects into its web view at document
 * start, so it applies to whichever wallet route that view happens to be
 * showing. Unset on the web, where it resolves to square.
 *
 * The rounding clips the content because `container` already sets
 * `overflowY: "auto"`, and per the CSS overflow spec an axis left at its
 * `visible` default resolves to `auto` once the other axis is non-visible — so
 * no extra `overflow` is needed alongside the radius.
 *
 * ## Why `&&`
 *
 * This class and `container` are two independent single-class selectors on the
 * same element, so at equal specificity the winner is whichever rule the bundler
 * emitted last — and it emits `container`'s `tabletContainerMedia` block after
 * this file's. Verified in a real build: `containerChromeless`'s tablet rule
 * landed at byte 77989 and `sharingPage.css`'s at 80435, so above the tablet
 * breakpoint the card treatment silently won and this variant did nothing.
 *
 * That was harmless while this class only cancelled things back to their
 * defaults. It is not harmless now: the host's radius has to win, or an Android
 * tablet's sheet paints a centred, drop-shadowed, all-four-corners card floating
 * inside it. `&&` doubles the class in the selector, which beats one class
 * whatever the emission order turns out to be.
 *
 * Inert this way since `504c7e026`, the commit that introduced it — not since the
 * corner-radius work, which never touched this file. Anyone bisecting corner
 * behaviour should start there, because every build in between rendered a
 * chromeless page as a card above 768px.
 */
export const containerChromeless = style({
    selectors: {
        "&&": {
            borderRadius: hostSheetTopRadius,
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    // The whole card treatment, not just its three most
                    // obvious properties: `tabletContainerMedia` also detaches
                    // the container from the viewport (`height: auto`,
                    // `maxHeight: 90dvh`, `margin: auto`). Leaving those set
                    // makes the sharing screen a floating card while
                    // `/install` — which has no tablet rule at all — stays
                    // full-bleed, so the sheet visibly jumps mid-flow. That is
                    // the exact bug this whole feature exists to remove.
                    maxWidth: "none",
                    maxHeight: "none",
                    height: "100dvh",
                    margin: 0,
                    boxShadow: "none",
                },
            },
        },
    },
});

/**
 * Footer bottom border-radius for tablet+ to match the container corners.
 */
export const tabletFooterMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        borderRadius: `0 0 ${alias.cornerRadius.xl} ${alias.cornerRadius.xl}`,
    },
};

const overlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

/**
 * Full-viewport overlay backdrop for tablet+.
 * On mobile, this is invisible (no styles applied).
 */
export const overlay = style({
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            animation: `${overlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
        },
    },
});

/**
 * Overlay variant for a host that presents this page inside its own sheet.
 *
 * The backdrop above is a web affordance: it dims the merchant's page behind a
 * floating card and gives the user somewhere to click to dismiss. A native host
 * already draws its own scrim, and the sheet's rounded top corners exist
 * precisely so that scrim shows through them — so leaving this on would tint
 * those corners 40% black instead, which is the one thing they must not do.
 *
 * Only reachable above the tablet breakpoint, but an Android tablet's sheet is
 * wide enough to get there. `&&` for the same reason as
 * [containerChromeless]: this has to win against a rule whose emission order
 * relative to it is a bundler detail.
 */
export const overlayChromeless = style({
    selectors: {
        "&&": {
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    position: "static",
                    backgroundColor: "transparent",
                    display: "block",
                    // The fade belongs to a card appearing over a page. The
                    // host cross-fades its own skeleton into this page and
                    // times that against first paint, so a second opacity ramp
                    // here fights it.
                    animation: "none",
                },
            },
        },
    },
});
