import { style } from "@vanilla-extract/css";

export const pairingView = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    width: "100%",
});

export const header = style({
    alignSelf: "stretch",
});

export const qrCodeWrapper = style({
    width: "224px",
});

export const status = style({
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
});
