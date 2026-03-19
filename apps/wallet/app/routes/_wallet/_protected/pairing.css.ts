import { style } from "@vanilla-extract/css";

export const pairingError = style({
    marginTop: "1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
});

export const pairingButtons = style({
    display: "flex",
    justifyContent: "space-between",
    marginTop: "1rem",
});

export const pairingButtonsSingle = style({
    justifyContent: "center",
});

export const pairingNoCodeNotice = style({
    marginTop: "0.75rem",
    textAlign: "center",
});
