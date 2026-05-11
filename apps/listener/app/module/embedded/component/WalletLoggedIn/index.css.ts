import { style } from "@vanilla-extract/css";

export const balance = style({
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    color: "var(--frak-color-grayText)",
});

export const balance__title = style({
    display: "inline",
    position: "relative",
    fontSize: "21px",
    fontWeight: 400,
});

export const balance__status = style({
    position: "absolute",
    bottom: "6px",
    marginLeft: "4px",
    fontSize: "11px",
    fontWeight: 400,
    fontStyle: "italic",
    whiteSpace: "nowrap",
});

export const balance__amount = style({
    fontSize: "34px",
    fontWeight: 600,
    textShadow: "0px 4px 4px #0000001a",
});

export const modalListenerWallet__actionButtons = style({
    display: "flex",
    justifyContent: "center",
    gap: "21px",
    margin: "140px 0 10px 0",
});

export const modalListenerWallet__wrapperButton = style({
    position: "relative",
});

export const modalListenerWallet__footer = style({
    display: "flex",
});
