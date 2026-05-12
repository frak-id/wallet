import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const dots = style({
    display: "flex",
    height: "6px",
    gap: alias.spacing.xxs,
    justifyContent: "center",
    alignItems: "center",
});

export const dot = style({
    appearance: "none",
    WebkitAppearance: "none",
    border: "none",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    font: "inherit",
    lineHeight: 0,
    cursor: "pointer",
    width: "6px",
    height: "6px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.icon.disabled,
    opacity: 0.7,
    // Inactive dots scale down to 4×4 visually. Using transform instead of
    // animating width/height keeps the size change on the GPU compositor —
    // animating layout properties on Safari inside a scroll-snap container
    // produced stuck/missed transitions on iOS.
    transform: "scale(0.6667)",
    transformOrigin: "center",
    WebkitTapHighlightColor: "transparent",
    transition:
        "transform 0.25s ease-out, opacity 0.25s ease-out",
});

export const dotActive = style({
    transform: "scale(1)",
    opacity: 1,
});
