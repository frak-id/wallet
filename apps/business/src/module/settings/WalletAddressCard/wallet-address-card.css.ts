import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing } from "@/module/common/styles/interaction.css";

export const row = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
});

export const address = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const copyButton = style([
    focusRing,
    {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        color: vars.icon.secondary,
        cursor: "pointer",
        transition: "color 0.15s ease",
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:hover": {
                        color: vars.icon.primary,
                    },
                },
            },
        },
    },
]);

export const copied = style({
    color: vars.icon.action,
});
