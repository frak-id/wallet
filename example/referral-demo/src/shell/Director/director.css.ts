import { brand as frakBrand, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { fonts } from "../device.css";

const ink = "#e9ecf5";
const muted = "rgba(233, 236, 245, 0.56)";
const line = "rgba(255, 255, 255, 0.08)";
const blue = "#3369f2";

export const content = style({
    display: "flex",
    flexDirection: "column",
    gap: 20,
    color: ink,
    fontFamily: fonts.inter,
});

export const brand = style({
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    fontWeight: 600,
    color: muted,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
});

export const now = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 18,
    borderRadius: 18,
    background: "rgba(255, 255, 255, 0.05)",
    border: `1px solid ${line}`,
});

export const nowMeta = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: muted,
});

export const phoneOf = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
});

export const nowTitle = style({
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "#fff",
});

export const nowNote = style({
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(233, 236, 245, 0.82)",
});

export const navRow = style({
    display: "flex",
    gap: 8,
    marginTop: 4,
});

export const navButton = recipe({
    base: {
        flex: 1,
        height: 40,
        paddingInline: 14,
        border: 0,
        borderRadius: 12,
        fontFamily: fonts.inter,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 160ms ease, opacity 160ms ease",
        selectors: {
            "&:disabled": { opacity: 0.35, cursor: "default" },
        },
    },
    variants: {
        tone: {
            solid: {
                background: blue,
                color: "#fff",
                selectors: {
                    "&:hover:not(:disabled)": {
                        background: frakBrand.colors.primary[600],
                    },
                },
            },
            ghost: {
                background: "rgba(255, 255, 255, 0.08)",
                color: ink,
                selectors: {
                    "&:hover:not(:disabled)": {
                        background: "rgba(255, 255, 255, 0.14)",
                    },
                },
            },
        },
    },
});

export const timeline = style({
    display: "flex",
    flexDirection: "column",
    gap: 16,
});

export const group = style({
    display: "flex",
    flexDirection: "column",
    gap: 6,
});

export const groupHeader = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
});

export const stepList = style({
    listStyle: "none",
    margin: 0,
    padding: "0 0 0 11px",
    borderLeft: `1px solid ${line}`,
    marginLeft: 11,
});

export const stepItem = recipe({
    base: {
        display: "block",
        width: "100%",
        padding: "6px 10px",
        border: 0,
        borderRadius: 8,
        background: "transparent",
        textAlign: "left",
        fontFamily: fonts.inter,
        fontSize: 13,
        cursor: "pointer",
        transition: "background 160ms ease, color 160ms ease",
        selectors: {
            "&:hover": { background: "rgba(255, 255, 255, 0.06)" },
        },
    },
    variants: {
        state: {
            current: {
                background: "rgba(51, 105, 242, 0.22)",
                color: "#fff",
                fontWeight: 600,
            },
            done: { color: "rgba(233, 236, 245, 0.7)" },
            todo: { color: muted },
        },
    },
});

export const settings = style({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingTop: 16,
    borderTop: `1px solid ${line}`,
});

export const settingRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    color: muted,
});

export const segmented = style({
    display: "inline-flex",
    padding: 3,
    borderRadius: 10,
    background: "rgba(255, 255, 255, 0.06)",
});

export const segment = recipe({
    base: {
        border: 0,
        borderRadius: 8,
        padding: "5px 10px",
        fontFamily: fonts.inter,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        background: "transparent",
        color: muted,
    },
    variants: {
        active: {
            true: { background: "rgba(255, 255, 255, 0.14)", color: "#fff" },
            false: {},
        },
    },
});

export const offline = style({
    fontSize: 12,
    color: "#f4b266",
});

export const offlineReady = style({
    color: "#6bd8a4",
});

export const hint = style({
    fontSize: 11,
    color: "rgba(233, 236, 245, 0.4)",
});

export const panel = style({
    width: 360,
    flexShrink: 0,
    height: "100%",
    overflowY: "auto",
    padding: "28px 24px",
    background: "#0b1020",
    borderLeft: `1px solid ${line}`,
});

/** Pull tab on the right edge: reachable on stage, out of the way of every screen. */
export const fab = style({
    position: "fixed",
    zIndex: 100,
    top: "50%",
    // Left edge: sheet close buttons and horizontal scrollers all live on the right.
    left: 0,
    width: 14,
    height: 56,
    marginTop: -28,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: "0 12px 12px 0",
    background: "rgba(6, 11, 31, 0.35)",
    color: "#fff",
    backdropFilter: "blur(10px)",
    opacity: 0.3,
    transition: "opacity 200ms ease, width 200ms ease",
    cursor: "pointer",
    selectors: {
        "&:hover, &:focus-visible": { opacity: 1, width: 24 },
    },
});

export const sheetBackdrop = style({
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0, 0, 0, 0.45)",
});

export const sheet = style({
    position: "fixed",
    zIndex: 201,
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
    overflowY: "auto",
    padding: "16px 20px",
    paddingBottom: `calc(${safeArea.bottom} + 20px)`,
    borderRadius: "24px 24px 0 0",
    background: "#0b1020",
    boxShadow: "0 -20px 60px rgba(0, 0, 0, 0.4)",
});

export const sheetHandle = style({
    width: 40,
    height: 5,
    margin: "0 auto 14px",
    borderRadius: 3,
    background: "rgba(255, 255, 255, 0.2)",
});
