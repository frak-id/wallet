import { style } from "@vanilla-extract/css";
import { brand } from "@/tokens.css";

export const logoutButton = style({
    width: "100%",
    justifyContent: "flex-start",
});

export const dialogContent = style({
    display: "flex",
    flexDirection: "column",
    gap: brand.scale[300],
});

export const dialogActions = style({
    display: "flex",
    flexWrap: "wrap",
    gap: brand.scale[200],
    justifyContent: "flex-end",
    marginTop: brand.scale[200],
});
