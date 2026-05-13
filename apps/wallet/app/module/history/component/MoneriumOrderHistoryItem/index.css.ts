import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const row = style({
    width: "100%",
    textAlign: "left",
});

export const iconWrapper = style({
    position: "relative",
    marginTop: 2,
    marginRight: 5,
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.tertiary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const info = style({
    minWidth: 0,
});

export const statusText = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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

const badgeInnerBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: alias.cornerRadius.full,
});

export const badgeInner = styleVariants({
    pending: [badgeInnerBase, { background: vars.icon.warning }],
    rejected: [badgeInnerBase, { background: vars.icon.error }],
});
