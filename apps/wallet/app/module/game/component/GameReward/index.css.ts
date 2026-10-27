import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.m,
    padding: `0 ${alias.spacing.m}`,
    textAlign: "center",
});

export const gameCard = style({
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});
