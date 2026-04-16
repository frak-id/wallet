import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const errorText = style({
    color: vars.text.error,
});

export const successIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.text.success,
});

export const merchantIcon = style({
    width: "48px",
    height: "48px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.surface.primary,
});

export const merchantImg = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const merchantLink = style({
    color: vars.text.action,
    textDecoration: "underline",
});

export const disclaimerLink = style({
    color: vars.text.action,
    textDecoration: "none",
});

export const ssoActions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});

const ssoContentBase = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const ssoContent = style([ssoContentBase, { justifyContent: "center" }]);

export const ssoContentTop = ssoContentBase;
