import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const row = style({
    position: "relative",
    width: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
    selectors: {
        "&:active": { background: vars.surface.disabled },
    },
});

export const highlight = recipe({
    base: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
    },
    variants: {
        tone: {
            action: { background: vars.surface.secondary },
            success: { background: vars.surface.success },
        },
    },
});

export const content = style({
    position: "relative",
});

export const logoWrapper = style({
    position: "relative",
    marginTop: 2,
    marginRight: 5,
    flexShrink: 0,
    height: "fit-content",
});

export const info = style({
    minWidth: 0,
});

export const statusText = recipe({
    variants: {
        wrap: {
            true: { textWrap: "balance" },
            false: {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            },
        },
    },
});

export const amount = style({
    flexShrink: 0,
});

export const badge = style({
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: alias.cornerRadius.full,
    padding: 2,
    background: vars.surface.background,
});

export const badgeInner = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: alias.cornerRadius.full,
    },
    variants: {
        status: {
            waitingFriend: { background: vars.icon.warning },
            settled: { background: vars.icon.secondary },
            bonus: { background: vars.icon.success },
        },
    },
});
