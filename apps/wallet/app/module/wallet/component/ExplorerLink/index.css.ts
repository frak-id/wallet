import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const explorerLink = style({
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
});

export const explorerLinkIcon = style({
    marginLeft: "auto",
});
