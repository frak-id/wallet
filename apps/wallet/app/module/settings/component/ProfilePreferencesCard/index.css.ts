import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    display: "flex",
    flexDirection: "column",
});

export const sectionTitle = style({
    marginBottom: alias.spacing.s,
});

export const row = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    borderTop: `1px solid ${vars.border.subtle}`,
    selectors: {
        "&:first-of-type": {
            borderTop: "none",
        },
    },
});

export const rowContent = style({
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
});

export const icon = style({
    marginTop: "2px",
    color: vars.icon.primary,
    flexShrink: 0,
});

export const textGroup = style({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

export const actionButton = style({
    flexShrink: 0,
});

export const switchControl = style({
    flexShrink: 0,
    marginRight: alias.spacing.m,
});

export const selectTrigger = style({
    minWidth: "132px",
});
