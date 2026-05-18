import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const radioGroup = style({
    display: "flex",
    flexDirection: "column",
});

export const radioGroupIndicator = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    position: "relative",
});

globalStyle(`${radioGroupIndicator}::after`, {
    content: '""',
    display: "block",
    width: "10px",
    height: "10px",
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.elevated,
});

export const radioGroupItem = style({
    all: "unset",
    backgroundColor: vars.surface.elevated,
    width: "20px",
    height: "20px",
    borderRadius: alias.cornerRadius.full,
    border: `2px solid ${vars.border.focus}`,
    cursor: "pointer",
    selectors: {
        "&:focus-visible": {
            boxShadow: `0 0 0 1px ${brand.colors.primary[500]}`,
        },
        [`&:has(.${radioGroupIndicator.split(" ")[0]})`]: {
            background: vars.border.focus,
        },
    },
});
