import { style } from "@vanilla-extract/css";

export const pairingView = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    width: "100%",
});

export const title = style({
    alignSelf: "flex-start",
});

export const qrCodeWrapper = style({
    width: "224px",
});

export const qrCode = style({
    position: "relative",
    display: "flex",
    justifyContent: "center",
});

export const status = style({
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
});

export const arena = style({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "56px",
    height: "56px",
    background: "#0043ef",
    color: "#ffffff",
    border: "4px solid #ffffff",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
});
