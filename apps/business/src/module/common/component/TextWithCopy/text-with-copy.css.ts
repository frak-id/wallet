import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

export const container = style({
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: "14px",
    width: "100%",
});

globalStyle(`${container} > :first-child`, {
    overflowX: "auto",
});

export const trigger = style([
    interactive,
    focusRing,
    {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        color: vars.icon.secondary,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ":hover": {
            color: vars.icon.primary,
        },
    },
]);
