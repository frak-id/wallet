import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Proportion bar + legend (16px between them). */
export const distribution = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});

/** 4px track (GreyTone20 @ 50%); the segments overlay it left→right. */
export const bar = style({
    display: "flex",
    width: "100%",
    height: "4px",
    borderRadius: "100px",
    overflow: "hidden",
    backgroundColor: "rgba(187, 196, 205, 0.5)",
});

export const barRewards = style({
    width: "80%",
    backgroundColor: vars.text.success,
});
export const barCommission = style({
    width: "20%",
    backgroundColor: vars.surface.primary,
});

export const legend = style({
    display: "flex",
    gap: alias.spacing.xl,
    alignItems: "center",
});

/** Coloured amount inside each legend label. */
export const amountRewards = style({ color: vars.text.success });
export const amountCommission = style({ color: vars.text.action });
