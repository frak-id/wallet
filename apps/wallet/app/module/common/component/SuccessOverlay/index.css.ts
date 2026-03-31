import { vars } from "@frak-labs/design-system/theme";
import { keyframes, style } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const fadeOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

export const overlay = style({
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 15,
    zIndex: 9999,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    animation: `${fadeIn} 200ms ease-out`,
});

export const overlayFadeOut = style({
    animation: `${fadeOut} 300ms ease-in forwards`,
});

export const card = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 107,
    height: 107,
    borderRadius: 30,
    backgroundColor: "#000000",
});

export const icon = style({
    color: vars.text.success,
});
