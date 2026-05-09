import { style } from "@vanilla-extract/css";

export const qrCode = style({
    position: "relative",
    display: "flex",
    justifyContent: "center",
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
