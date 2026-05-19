import { style } from "@vanilla-extract/css";

export const description = style({
    margin: "0 0 16px",
    fontSize: "14px",
    // TODO: token (text-secondary)
    color: "#666",
});

export const domainList = style({
    listStyle: "none",
    padding: 0,
    margin: "0 0 16px",
});

export const domainItem = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    // TODO: token (border)
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    marginBottom: "8px",
    fontSize: "14px",
});

export const error = style({
    margin: "4px 0 0",
    fontSize: "12px",
    // TODO: token (color-danger)
    color: "#e53e3e",
});
