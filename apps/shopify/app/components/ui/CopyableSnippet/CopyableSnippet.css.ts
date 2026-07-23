import { style } from "@vanilla-extract/css";

export const wrapper = style({
    position: "relative",
});

export const snippet = style({
    background: "#f6f6f7",
    border: "1px solid #e1e3e5",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    whiteSpace: "pre",
    overflowX: "auto",
    color: "#202223",
    margin: 0,
});

export const copyButton = style({
    position: "absolute",
    top: 8,
    right: 8,
});

export const inlineCode = style({
    fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.9em",
    background: "#f1f2f3",
    borderRadius: 4,
    padding: "1px 5px",
    color: "#202223",
});
