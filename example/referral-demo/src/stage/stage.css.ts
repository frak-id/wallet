import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "@/shell/device.css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    padding: "0 22px",
    paddingTop: `calc(${deviceInset.top} + 16px)`,
    paddingBottom: `calc(${deviceInset.bottom} + 20px)`,
    color: "#fff",
    fontFamily: fonts.inter,
    background: [
        "radial-gradient(120% 60% at 0% 0%, rgba(51, 105, 242, 0.45), transparent 60%)",
        "radial-gradient(90% 50% at 100% 100%, rgba(180, 83, 42, 0.28), transparent 60%)",
        "#060b1f",
    ].join(", "),
});

export const topBar = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#fff",
});

export const overline = style({
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.6)",
});

export const title = style({
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 700,
    letterSpacing: "-0.03em",
});

export const lede = style({
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(255, 255, 255, 0.72)",
});

export const hero = style({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 40,
});

export const cards = style({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 28,
});

export const scenarioCard = style({
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: 16,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    background: "rgba(255, 255, 255, 0.06)",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    transition: "background 160ms ease, transform 160ms ease",
    selectors: {
        "&:hover": { background: "rgba(255, 255, 255, 0.1)" },
        "&:active": { transform: "scale(0.98)" },
    },
});

export const cardText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const cardLabel = style({
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.55)",
});

export const cardTitle = style({
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.01em",
});

export const cardPath = style({
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.65)",
});

export const arrow = style({
    fontSize: 20,
    color: "rgba(255, 255, 255, 0.5)",
});

export const textLink = style({
    alignSelf: "center",
    marginTop: 20,
    padding: 8,
    border: 0,
    background: "transparent",
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
});

export const footer = style({
    marginTop: "auto",
    paddingTop: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
});

export const offline = recipe({
    base: { fontWeight: 600 },
    variants: {
        ready: {
            true: { color: "#6bd8a4" },
            false: { color: "#f4b266" },
        },
    },
});

export const langToggle = style({
    display: "inline-flex",
    padding: 3,
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.1)",
});

export const langButton = recipe({
    base: {
        border: 0,
        borderRadius: 999,
        padding: "5px 11px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        background: "transparent",
        color: "rgba(255, 255, 255, 0.6)",
    },
    variants: {
        active: {
            true: { background: "#fff", color: "#060b1f" },
            false: {},
        },
    },
});

export const introBody = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 14,
    marginTop: 36,
});

export const name = style({
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.02em",
});

export const roleChip = style({
    padding: "5px 12px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.12)",
    fontSize: 13,
    fontWeight: 600,
});

export const story = style({
    maxWidth: 320,
    fontSize: 16,
    lineHeight: 1.55,
    color: "rgba(255, 255, 255, 0.78)",
});

export const journey = style({
    alignSelf: "stretch",
    listStyle: "none",
    margin: "12px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    textAlign: "left",
});

export const journeyItem = style({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 16,
    background: "rgba(255, 255, 255, 0.06)",
    fontSize: 14,
    fontWeight: 500,
});

export const journeyIndex = style({
    flexShrink: 0,
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "rgba(51, 105, 242, 0.35)",
    fontSize: 13,
    fontWeight: 700,
});

export const primaryButton = style({
    width: "100%",
    height: 54,
    marginTop: 24,
    border: 0,
    borderRadius: 27,
    background: "#fff",
    color: "#060b1f",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 160ms ease",
    selectors: { "&:active": { transform: "scale(0.98)" } },
});

export const installButton = style({
    padding: "8px 16px",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: 999,
    background: "transparent",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
});
