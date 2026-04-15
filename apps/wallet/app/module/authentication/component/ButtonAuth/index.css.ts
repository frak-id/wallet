import { keyframes, style } from "@vanilla-extract/css";

const pulse = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.5 },
});

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

export const buttonAuth = style({
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, #425dad 0%, #2d3561 100%)",
    border: "none",
    borderRadius: "var(--frak-button-border-radius)",
    boxShadow:
        "0 25px 50px -12px rgba(76, 99, 210, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    transition: "all 0.3s ease",
    cursor: "pointer",
    color: "var(--frak-color-white)",
    transform: "translateY(0)",
    padding: "var(--frak-spacing-l)",
    width: "100%",
    selectors: {
        "&:hover": {
            background: "linear-gradient(135deg, #5a70d8 0%, #3a4270 100%)",
            boxShadow:
                "0 32px 64px -12px rgba(76, 99, 210, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)",
            transform: "translateY(-2px)",
        },
        "&:active": {
            transform: "translateY(1px)",
            boxShadow:
                "0 20px 40px -12px rgba(76, 99, 210, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            transition: "all 0.1s ease",
        },
        "&:focus-visible": {
            outline: "2px solid #60a5fa",
            outlineOffset: "2px",
        },
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
            transform: "none",
        },
    },
    "@media": {
        "(hover: none) and (pointer: coarse)": {
            selectors: {
                "&:hover": {
                    transform: "none",
                },
                "&:active": {
                    transform: "translateY(1px)",
                    background:
                        "linear-gradient(135deg, #3a4b96 0%, #252a50 100%)",
                },
            },
        },
    },
});

export const overlay = style({
    position: "absolute",
    inset: 0,
    background:
        "linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%)",
    opacity: 0,
    transition: "opacity 0.3s ease",
    selectors: {
        [`${buttonAuth}:hover &`]: {
            opacity: 1,
        },
    },
});

export const content = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    position: "relative",
    zIndex: 10,
    textAlign: "left",
    "@media": {
        "(max-width: 480px)": {
            flexDirection: "column",
            textAlign: "center",
        },
    },
});

export const iconWrapper = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2rem",
    height: "2rem",
});

export const icon = style({
    width: "2rem",
    height: "2rem",
    color: "white",
    transition: "transform 0.3s ease",
    selectors: {
        [`${buttonAuth}:hover &`]: {
            transform: "scale(1.1) rotate(12deg)",
        },
    },
});

export const pulsingIcon = style({
    animation: `${pulse} 2s infinite`,
});

export const spinner = style({
    position: "absolute",
    inset: "-4px",
    borderRadius: "50%",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTopColor: "white",
    animation: `${spin} 1s linear infinite`,
});

export const text = style({
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: 500,
    fontSize: "0.95rem",
    lineHeight: 1.4,
    transition: "transform 0.3s ease",
});

export const shimmer = style({
    position: "absolute",
    inset: 0,
    background:
        "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
    transform: "translateX(-100%) skewX(12deg)",
    transition: "transform 1s ease",
    selectors: {
        [`${buttonAuth}:hover &`]: {
            transform: "translateX(100%) skewX(12deg)",
        },
    },
});
