import { styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: alias.cornerRadius.full,
    paddingTop: alias.spacing.xxs,
    paddingBottom: alias.spacing.xxs,
    paddingLeft: alias.spacing.xs,
    paddingRight: alias.spacing.xs,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
};

export const badgeVariants = styleVariants({
    success: {
        ...base,
        backgroundColor: vars.surface.success,
        color: vars.text.success,
    },
    warning: {
        ...base,
        backgroundColor: vars.surface.warning,
        color: vars.text.warning,
    },
    error: {
        ...base,
        backgroundColor: vars.surface.error,
        color: vars.text.error,
    },
    info: {
        ...base,
        backgroundColor: vars.surface.secondary,
        color: vars.text.action,
    },
    neutral: {
        ...base,
        backgroundColor: vars.surface.muted,
        color: vars.text.secondary,
    },
});
