import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

export const list = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
});

export const item = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.muted,
});

export const thumb = style({
    width: "48px",
    height: "32px",
    flexShrink: 0,
    borderRadius: alias.cornerRadius.s,
    overflow: "hidden",
    backgroundColor: vars.surface.muted,
});

globalStyle(`${thumb} img`, {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const url = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    color: vars.text.tertiary,
});

export const deleteButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        flexShrink: 0,
        cursor: "pointer",
        borderRadius: alias.cornerRadius.full,
        color: vars.text.secondary,
        selectors: {
            "&:hover": {
                color: vars.text.primary,
            },
        },
    },
]);

export const preview = style({
    position: "absolute",
    left: "60px",
    top: "calc(100% + 6px)",
    zIndex: 10,
    pointerEvents: "none",
    width: "280px",
    height: "160px",
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
    border: `1px solid ${vars.border.default}`,
    backgroundColor: vars.surface.muted,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
});

globalStyle(`${preview} img`, {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
});
