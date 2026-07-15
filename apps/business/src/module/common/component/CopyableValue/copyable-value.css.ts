import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

/** Elevated pill that reads as a copy-me value: optional helper line above a
 * value + trailing copy icon. */
export const box = style({
    display: "flex",
    flexDirection: "column",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.m,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.s,
    paddingTop: alias.spacing.s,
    paddingBottom: alias.spacing.s,
});

/** Instruction line sitting above the value row. */
export const helper = style({
    paddingBottom: alias.spacing.xs,
});

/** Value + copy button, aligned on one line. */
export const row = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

/** Single-line, ellipsised value (monospace so codes/keys read clearly). */
export const value = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    userSelect: "all",
});

export const copyButton = style([
    interactive,
    focusRing,
    {
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 0",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: vars.icon.secondary,
        ":hover": {
            color: vars.icon.primary,
        },
    },
]);
