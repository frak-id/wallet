import { style } from "@vanilla-extract/css";
import { fonts, iosColors } from "@/shell/device.css";

const iosBlue = iosColors.blue;

export const closeButton = style({
    position: "absolute",
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: "50%",
    background: "rgba(120, 120, 128, 0.16)",
    color: "#3c3c43",
    cursor: "pointer",
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    paddingTop: 12,
    textAlign: "center",
});

export const glyph = style({
    color: iosBlue,
});

export const title = style({
    margin: 0,
    maxWidth: 300,
    fontSize: 20,
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.01em",
});

export const body = style({
    margin: 0,
    maxWidth: 310,
    fontSize: 15,
    lineHeight: 1.35,
    color: "rgba(60, 60, 67, 0.72)",
});

export const account = style({
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 16,
    background: "#fff",
    textAlign: "left",
});

export const accountIcon = style({
    flexShrink: 0,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "rgba(120, 120, 128, 0.12)",
    color: "#3c3c43",
});

export const accountText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
});

export const accountName = style({
    fontSize: 16,
    fontWeight: 600,
});

export const accountDomain = style({
    fontSize: 13,
    color: "rgba(60, 60, 67, 0.6)",
});

export const continueButton = style({
    alignSelf: "stretch",
    height: 52,
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: 0,
    borderRadius: 26,
    background: iosBlue,
    color: "#fff",
    fontFamily: fonts.system,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
    selectors: {
        "&:active": { transform: "scale(0.97)", opacity: 0.85 },
        "&:disabled": { opacity: 0.55, cursor: "default" },
    },
});

export const otherOptions = style({
    padding: "6px 12px",
    border: 0,
    background: "transparent",
    color: iosBlue,
    fontFamily: fonts.system,
    fontSize: 15,
    fontWeight: 500,
});

export const hud = style({
    position: "absolute",
    zIndex: 40,
    top: "27%",
    left: "50%",
    width: 150,
    height: 150,
    marginTop: -75,
    marginLeft: -75,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 34,
    background: "rgba(236, 236, 240, 0.92)",
    backdropFilter: "saturate(180%) blur(24px)",
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.22)",
    color: "#1c1c1e",
    fontFamily: fonts.system,
});

export const hudGlyph = style({
    position: "relative",
    width: 68,
    height: 68,
    display: "grid",
    placeItems: "center",
});

export const hudLabel = style({
    fontSize: 15,
    fontWeight: 600,
});
