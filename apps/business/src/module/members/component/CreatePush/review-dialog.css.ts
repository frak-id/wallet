import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// `&&` to out-cascade the shared DialogContent base (bg/radius/padding).
export const modal = style({
    selectors: {
        "&&": {
            backgroundColor: vars.surface.background2,
            borderRadius: alias.cornerRadius.xl,
            paddingBottom: 0,
        },
    },
});

export const badgeIcon = style({
    color: vars.icon.action,
});

export const title = style({
    margin: 0,
    fontSize: fontSize.xl,
    lineHeight: "30px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    textAlign: "center",
});

export const textBlock = style({
    width: "100%",
});

// White recap card standing out against the grey modal surface.
export const cellsCard = style({
    width: "100%",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.l,
    overflow: "hidden",
});

// Only the non-token vertical padding (49px row = 13.5 + 22 line + 13.5);
// the flex/align/gap/horizontal-padding come from <Inline>.
export const cellRow = style({
    paddingBlock: "13.5px",
});

export const errorBanner = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.xs,
    marginTop: alias.spacing.m,
    padding: alias.spacing.s,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.error,
});

export const errorIcon = style({
    flexShrink: 0,
    width: "20px",
    height: "20px",
    color: vars.text.error,
});

export const button = style({
    flex: 1,
});
