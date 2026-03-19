import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

const base = style({
    borderRadius: alias.cornerRadius.xl,
    overflow: "hidden",
});

export const cardStyles = {
    base,
    elevated: style([
        base,
        {
            backgroundColor: vars.surface.elevated,
            border: `1px solid ${vars.border.subtle}`,
        },
    ]),
    muted: style([
        base,
        {
            backgroundColor: vars.surface.muted,
        },
    ]),
    paddingNone: style({
        padding: "0",
    }),
    paddingCompact: style({
        padding: alias.spacing.s,
    }),
    paddingDefault: style({
        padding: alias.spacing.m,
    }),
};
