import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const login = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "55px 0 0 20px",
    "@media": {
        "screen and (max-height: 520px)": {
            marginTop: "20px",
            alignItems: "flex-start",
        },
        "screen and (max-width: 768px)": {
            margin: "56px 20px",
            flexDirection: "column",
        },
    },
});

export const title = style({
    margin: 0,
    fontSize: "56px",
    color: "#191a15",
    "@media": {
        "screen and (max-width: 768px)": {
            marginTop: "71px",
            fontSize: "30px",
            lineHeight: "40px",
        },
    },
});

export const subTitle = style({
    margin: 0,
    fontSize: "18px",
    "@media": {
        "screen and (max-width: 768px)": {
            marginTop: "15px",
            fontSize: "15px",
            lineHeight: "17px",
        },
    },
});

export const image = style({
    display: "block",
    margin: "0 auto",
});

export const panel = style({
    maxWidth: "612px",
    padding: "25px 86px 40px 86px",
    borderRadius: "20px 0 0 20px",
    background: "#ffffff99",
    backdropFilter: "blur(100px)",
    boxShadow: "0 4px 30px -13px #00000040",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "flex",
            flexDirection: "column",
            marginTop: "65px",
            padding: 0,
            borderRadius: 0,
            border: 0,
            background: "none",
            backdropFilter: "initial",
            boxShadow: "none",
            maxWidth: "none",
        },
    },
});

export const text = style({
    padding: "30px 0 38px 0",
    fontWeight: brand.typography.fontWeight.regular,
});

export const button = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "20px 30px",
    width: "100%",
    borderRadius: alias.cornerRadius.m,
    backgroundColor: "#135ade",
    color: brand.colors.neutral.white,
    textAlign: "center",
    fontSize: "18px",
    cursor: "pointer",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.5,
        },
    },
    "@media": {
        "screen and (max-width: 768px)": {
            order: -1,
        },
    },
});

export const footer = style({
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "0 35px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "16px",
    lineHeight: "30px",
    "@media": {
        "screen and (max-width: 768px)": {
            flexDirection: "column",
            padding: "0 20px",
            fontSize: "14px",
        },
    },
});

export const list = style({
    display: "flex",
    gap: "34px",
});

export const listItem = style({
    position: "relative",
    selectors: {
        "&:before": {
            position: "absolute",
            left: "-20px",
            content: "•",
            color: "#a6a6a6",
            fontSize: "12px",
        },
        "&:first-child:before": {
            display: "none",
        },
    },
});

export const phone = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

globalStyle(`${login} > div:first-child`, {
    flex: 1,
});

globalStyle(`${panel} ${image}`, {
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

globalStyle(`${login} > div`, {
    "@media": {
        "screen and (max-width: 768px)": {
            width: "100%",
        },
    },
});
