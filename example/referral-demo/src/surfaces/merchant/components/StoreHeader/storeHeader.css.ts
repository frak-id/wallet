import { style } from "@vanilla-extract/css";
import { palette } from "../page.css";

export const announcement = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    padding: "0 16px",
    background: palette.ink,
    color: palette.paper,
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
});

export const header = style({
    position: "sticky",
    top: 0,
    zIndex: 3,
    background: palette.paper,
    borderBottom: `1px solid ${palette.line}`,
});

export const bar = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
    padding: "0 6px",
});

export const side = style({
    display: "flex",
    alignItems: "center",
});

export const logo = style({
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 150,
    height: 20,
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
});

export const bag = style({ position: "relative" });

export const badge = style({
    position: "absolute",
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    borderRadius: 8,
    background: palette.ink,
    color: palette.paper,
    fontSize: 9.5,
    fontWeight: 600,
    lineHeight: "16px",
    textAlign: "center",
});

export const nav = style({
    display: "flex",
    gap: 20,
    padding: "0 16px 12px",
    overflowX: "auto",
    scrollbarWidth: "none",
    whiteSpace: "nowrap",
    selectors: { "&::-webkit-scrollbar": { display: "none" } },
});

export const navItem = style({
    fontSize: 12.5,
    fontVariant: "small-caps",
    letterSpacing: "0.08em",
    textTransform: "lowercase",
    color: palette.ink,
});

export const checkoutHeader = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    height: 60,
    padding: "0 8px",
    background: "#fff",
    borderBottom: "1px solid #e6e6e6",
});
