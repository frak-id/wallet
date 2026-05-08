import { style } from "@vanilla-extract/css";

export const buttonAction = style({
    width: "75px",
    height: "75px",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#fff",
    boxShadow: "-4px -4px 7px 0 #00000040 inset",
    color: "#242321",
    fontSize: "10px",
    cursor: "pointer",
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    whiteSpace: "nowrap",
});
