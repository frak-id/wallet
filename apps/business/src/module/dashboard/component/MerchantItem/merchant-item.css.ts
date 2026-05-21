import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const merchantItem = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "295px",
    height: "413px",
    borderRadius: alias.cornerRadius.m,
    background: vars.surface.secondary,
    border: `1px solid ${vars.border.default}`,
    color: vars.text.primary,
    lineHeight: "20px",
    textAlign: "center",
    fontSize: "19px",
    transition: "background 0.3s, border-color 0.3s",
    selectors: {
        "&:hover": {
            background: vars.surface.secondaryHover,
            borderColor: vars.border.focus,
        },
    },
});

export const merchantItemName = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
});

export const merchantItemDomain = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.tertiary,
});

export const merchantItemActions = style({
    position: "absolute",
    bottom: "75px",
    display: "flex",
    gap: "10px",
});

globalStyle(`${merchantItemActions} a`, {
    display: "flex",
});
