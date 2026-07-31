import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export {
    cellLabel,
    cellValue,
    detailCell,
    detailCells,
    statusSuccess,
} from "../detail-cells.css";

export const domainTag = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.xs}`,
    backgroundColor: vars.surface.muted,
    color: vars.text.primary,
    borderRadius: alias.cornerRadius.s,
    fontSize: fontSize.xs,
});

export const cellsEmpty = style({
    margin: 0,
    fontSize: fontSize.xs,
    lineHeight: "20px",
    color: vars.text.secondary,
});
