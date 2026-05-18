import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const switchRoot = style({
    all: "unset",
    width: "36px",
    height: "20px",
    backgroundColor: vars.border.default,
    borderRadius: alias.cornerRadius.full,
    position: "relative",
    WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
    cursor: "pointer",
    selectors: {
        '&[data-state="checked"]': {
            backgroundColor: brand.colors.primary[500],
        },
        "&[data-disabled]": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});

export const switchThumb = style({
    display: "block",
    width: "12px",
    height: "12px",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.full,
    transition: "transform 100ms",
    transform: "translateX(4px)",
    willChange: "transform",
    selectors: {
        '&[data-state="checked"]': {
            transform: "translateX(20px)",
        },
    },
});
