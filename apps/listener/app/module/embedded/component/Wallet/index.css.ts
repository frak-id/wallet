import {
    globalStyle,
    keyframes,
    style,
    styleVariants,
} from "@vanilla-extract/css";

/* Animation duration tokens — defined as :root CSS variables so the
 * `@media (min-width: 431px)` rule below can override them globally
 * (mirrors the original `index.module.css` setup). */
globalStyle(":root", {
    vars: {
        "--animation-duration-width": "0.3s",
        "--animation-duration-height": "0.3s",
    },
});

globalStyle(":root", {
    "@media": {
        "(min-width: 431px)": {
            vars: {
                "--animation-duration-width": "0.55s",
            },
        },
    },
});

const resizeWidthKf = keyframes({
    "0%": { width: 0 },
    "70%": { width: "calc(102% - 40px)" },
    "100%": { width: "calc(100% - 40px)" },
});

const resizeHeightKf = keyframes({
    "0%": { height: 0 },
    "70%": { height: "360px" },
    "100%": { height: "auto", minHeight: "350px" },
});

const opacityKf = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

export const modalListenerWallet = style({
    position: "fixed",
    bottom: "19px",
    zIndex: 1001,
    borderRadius: "25px",
    border: "2px solid #fff",
    textAlign: "center",
    animation: `${resizeWidthKf} var(--animation-duration-width) ease-in-out forwards, ${resizeHeightKf} var(--animation-duration-height) ease-in-out forwards`,
    minHeight: "48px",
    maxWidth: "430px",
    background:
        "radial-gradient(75.96% 75.96% at 50.42% 24.04%, #f2f2f2 20%, #3e557e 100%)",
    color: "#1d1d1d",
});

export const position = styleVariants({
    left: { left: "19px" },
    right: { right: "19px" },
});

export const modalListenerWallet__inner = style({
    opacity: 0,
    padding: "40px",
    height: "100%",
    overflow: "hidden",
    animation: `${opacityKf} 0.3s 0.2s forwards`,
    /* Create a new stacking context for the toaster to be inside our modal */
    transform: "translateZ(0)",
});

export const modalListenerWallet__innerLoggedIn = style({
    padding: "9px",
});

export const modalListenerWallet__header = style({
    position: "relative",
});

globalStyle(`${modalListenerWallet__header} h1`, {
    display: "flex",
    justifyContent: "center",
    margin: 0,
});

export const modalListenerWallet__logoFrak = style({
    position: "absolute",
    left: 0,
    top: "8px",
});

export const modalListenerWallet__logo = style({
    marginBottom: "30px",
    maxWidth: "50%",
    selectors: {
        [`${modalListenerWallet__innerLoggedIn} &`]: {
            marginBottom: "10px",
            maxWidth: "30%",
        },
    },
});
