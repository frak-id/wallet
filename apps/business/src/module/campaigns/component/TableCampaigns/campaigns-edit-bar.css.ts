import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const bar = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    marginBottom: alias.spacing.s,
    backgroundColor: vars.surface.elevated,
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.m,
});

export const count = style({
    fontSize: "16px",
    fontWeight: 500,
    color: vars.text.action,
    whiteSpace: "nowrap",
});
