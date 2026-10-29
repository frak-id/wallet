import { alias, brand } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

const { white, grey100, grey600, grey700 } = brand.colors.neutral;
const { primary, success, warning } = brand.colors;

const STUB = 104;
const NOTCH = 11;

const pop = keyframes({
    "0%": { opacity: 0, transform: "scale(0.5) rotate(-10deg)" },
    "60%": { opacity: 1, transform: "scale(1.15) rotate(-10deg)" },
    "100%": { opacity: 1, transform: "scale(1) rotate(-10deg)" },
});

const tearMask = `radial-gradient(circle at ${STUB - 1}px 0, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px) top / 100% 51% no-repeat, radial-gradient(circle at ${STUB - 1}px 100%, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px) bottom / 100% 51% no-repeat`;

/** Wraps the masked face: a mask clips box-shadow, a drop-shadow filter does not. */
export const root = style({
    position: "relative",
    filter: "drop-shadow(0 4px 14px rgba(20, 30, 60, 0.12))",
});

export const face = style({
    display: "flex",
    minHeight: 118,
    borderRadius: alias.cornerRadius.xl,
    overflow: "hidden",
    background: white,
    mask: tearMask,
    WebkitMask: tearMask,
});

export const stub = recipe({
    base: {
        position: "relative",
        flex: "0 0 auto",
        width: STUB,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingInline: 8,
        color: white,
        borderRight: "2px dashed rgba(255, 255, 255, 0.55)",
        textAlign: "center",
    },
    variants: {
        tone: {
            active: {
                background: `linear-gradient(160deg, ${primary[600]}, ${primary[800]})`,
            },
            muted: {
                background: `linear-gradient(160deg, ${grey600}, ${grey700})`,
            },
        },
    },
});

export const count = recipe({
    base: { fontWeight: 800, lineHeight: 1 },
    variants: {
        size: {
            short: { fontSize: 40 },
            medium: { fontSize: 32 },
            long: { fontSize: 26 },
        },
    },
});

export const prize = recipe({
    base: { fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" },
    variants: {
        size: {
            short: { fontSize: 34 },
            medium: { fontSize: 29 },
            long: { fontSize: 22 },
            longest: { fontSize: 18 },
        },
    },
});

export const unit = style({
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
});

export const stamp = style({
    position: "absolute",
    top: 8,
    right: 6,
    padding: "2px 8px",
    borderRadius: alias.cornerRadius.s,
    background: success[800],
    color: white,
    fontSize: 13,
    fontWeight: 800,
    transform: "rotate(-10deg)",
    boxShadow: "0 3px 8px rgba(0, 0, 0, 0.2)",
    animation: `${pop} 0.5s 0.2s cubic-bezier(0.23, 1, 0.32, 1) both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": { animation: "none" },
    },
});

export const main = style({
    flex: "1 1 auto",
    minWidth: 0,
    padding: "12px 14px 10px 18px",
});

/** The card's main action: its `::after` stretches over the whole card. */
export const mainButton = style({
    padding: 0,
    background: "transparent",
    border: "none",
    textAlign: "left",
    color: grey600,
    cursor: "pointer",
    outline: "none",
    selectors: {
        "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
        },
        "&:focus-visible::after": {
            outline: `3px solid ${primary[600]}`,
            outlineOffset: -3,
            borderRadius: alias.cornerRadius.xl,
        },
    },
});

export const pill = recipe({
    base: {
        flex: "0 0 auto",
        padding: "1px 8px",
        borderRadius: alias.cornerRadius.full,
        background: grey100,
        color: grey700,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
    },
    variants: {
        urgent: { true: { background: warning[500] } },
    },
});

export const headline = recipe({
    base: {
        color: primary[700],
        fontWeight: 800,
        overflowWrap: "anywhere",
    },
    variants: {
        kind: {
            amount: { fontSize: 28, lineHeight: 1.15 },
            description: {
                fontSize: 22,
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
            },
        },
    },
});

export const status = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        minHeight: 40,
        textAlign: "left",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.3,
    },
    variants: {
        tone: {
            action: { color: primary[700] },
            locked: { color: grey700 },
            done: { color: success[800] },
        },
    },
});

export const statusText = style({
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
});

export const icon = style({ flex: "0 0 auto" });
