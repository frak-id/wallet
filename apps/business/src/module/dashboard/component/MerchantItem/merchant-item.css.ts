import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const cell = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.m,
});

export const avatarWrap = style({
    width: "44px",
    paddingBlock: "2px",
    flexShrink: 0,
});

export const body = style({
    flex: 1,
    minWidth: 0,
});

export const name = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
