import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export { body, footer } from "../stepLayout.css";

export const balanceRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});

export const checkboxRow = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.s,
    cursor: "pointer",
});

export const checkboxInput = style({
    marginTop: "3px",
    width: "16px",
    height: "16px",
});
