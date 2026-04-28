import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize, shadow } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

/**
 * Inline emphasis for the partner device name inside the description Trans.
 *
 * Box sprinkles can't target a `<strong>` injected by `react-i18next`'s
 * `Trans` `components` slot, so this lives as a one-off CSS class.
 */
export const requestFrom = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: brand.scale[100],
    padding: `${brand.scale[50]} ${brand.scale[100]}`,
    color: vars.text.primary,
    border: `1px solid ${vars.border.default}`,
});

/**
 * Reject button — danger color override on top of the design-system Button
 * (which has no built-in `danger` variant yet).
 */
export const rejectButton = style({
    color: vars.text.error,
    borderColor: vars.border.error,
});

/**
 * Floating banner shown across all routes when the modal is dismissed.
 *
 * Positioning offsets, focus shadow, animation and the desktop media query
 * are not exposed via design-system sprinkles, so they live here. All
 * colors / spacing / layout come from `<Box>` sprinkles in the JSX.
 */
const subtlePulse = keyframes({
    "0%, 100%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.015)" },
});

export const bannerLayout = style({
    position: "fixed",
    left: brand.scale[400],
    right: brand.scale[400],
    bottom: `calc(${brand.scale[400]} + env(safe-area-inset-bottom, 0px))`,
    zIndex: 50,
    border: "none",
    boxShadow: shadow.dialog,
    animation: `${subtlePulse} 2.4s ease-in-out infinite`,
    "@media": {
        "(min-width: 768px)": {
            left: "auto",
            maxWidth: "420px",
        },
    },
});

export const bannerCta = style({
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.semiBold,
    textDecoration: "underline",
});
