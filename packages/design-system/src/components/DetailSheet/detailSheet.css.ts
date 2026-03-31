import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, zIndex } from "../../tokens.css";

export const containerStyle = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
});

export const heroStyle = style({
    position: "relative",
    flexShrink: 0,
    overflow: "hidden",
    height: "var(--detail-sheet-hero-height, 350px)",
});

export const actionsStyle = style({
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: `max(${alias.spacing.m}, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
    zIndex: zIndex.modal,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
});

export const bodyStyle = style({
    position: "relative",
    zIndex: 1,
    marginTop: `calc(-1 * ${alias.cornerRadius.xl})`,
    borderRadius: `${alias.cornerRadius.xl} ${alias.cornerRadius.xl} 0 0`,
    backgroundColor: vars.surface.background2,
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
    flex: 1,
});

export const footerStyle = style({
    flexShrink: 0,
    padding: `${alias.spacing.m} ${alias.spacing.xl}`,
    paddingBottom: `max(${alias.spacing.xl}, env(safe-area-inset-bottom))`,
    backgroundColor: vars.surface.background2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
});
