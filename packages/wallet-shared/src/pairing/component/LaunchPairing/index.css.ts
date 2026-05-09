import { keyframes, style } from "@vanilla-extract/css";

const fadeInKeyframes = keyframes({
    from: { opacity: 0, transform: "scale(0.98)" },
    to: { opacity: 1, transform: "scale(1)" },
});

const fadeOutKeyframes = keyframes({
    from: { opacity: 1, transform: "scale(1)" },
    to: { opacity: 0, transform: "scale(0.98)" },
});

export const launchPairing = style({
    margin: "20px auto",
    width: "100%",
    boxSizing: "border-box",
});

export const launchPairing__status = style({
    marginTop: "8px",
    textAlign: "center",
});

export const launchPairing__qrCode = style({
    all: "unset",
    display: "block",
    margin: "0 auto",
    cursor: "pointer",
});

export const launchPairing__brighterQRCode = style({
    position: "fixed",
    inset: 0,
    backgroundColor: "#fff",
    zIndex: 1000,
    color: "#000",
    borderRadius: "var(--frak-radius-l)",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    textAlign: "center",
    opacity: 0,
    animationName: fadeInKeyframes,
    animationDuration: "0.4s",
    animationTimingFunction: "ease",
    animationFillMode: "forwards",
});

export const fadeOut = style({
    animationName: fadeOutKeyframes,
    animationDuration: "0.4s",
    animationTimingFunction: "ease",
    animationFillMode: "forwards",
});
