import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

export const page = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
});

export const labelRow = style({
    paddingInline: alias.spacing.m,
});

export const hintRow = style({
    paddingInline: alias.spacing.m,
});

export const checkIcon = style({
    color: vars.icon.success,
    flexShrink: 0,
});

const skeletonShimmer = keyframes({
    "0%": { opacity: 0.55 },
    "50%": { opacity: 0.85 },
    "100%": { opacity: 0.55 },
});

export const skeletonInput = style({
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: "56px",
    paddingInline: alias.spacing.m,
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.m,
});

export const skeletonBar = style({
    width: "60%",
    height: "12px",
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.disabled,
    animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
});

export const disclosure = style({
    marginTop: "auto",
});
