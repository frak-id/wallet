import { style } from "@vanilla-extract/css";

export const container = style({
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: 640,
    margin: "48px auto",
    padding: "0 16px",
    color: "#202223",
});

export const card = style({
    border: "1px solid #e1e3e5",
    borderRadius: 12,
    padding: "20px 24px",
    background: "#fff",
});

export const title = style({
    fontSize: 18,
    margin: "0 0 8px",
});

export const description = style({
    margin: "0 0 16px",
    color: "#6d7175",
});

export const reference = style({
    margin: "0 0 16px",
    fontSize: 13,
    color: "#6d7175",
});

export const referenceId = style({
    background: "#f6f6f7",
    borderRadius: 4,
    padding: "1px 5px",
    fontSize: 12,
    color: "#202223",
});

export const referenceHint = style({
    color: "#8c9196",
});

export const refresh = style({
    border: "1px solid #8a8a8a",
    borderRadius: 8,
    padding: "6px 14px",
    background: "#f6f6f7",
    cursor: "pointer",
    fontSize: 14,
});

export const detailsSummary = style({
    cursor: "pointer",
    color: "#6d7175",
    fontSize: 13,
});

export const details = style({
    marginTop: 16,
});

export const stack = style({
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#f6f6f7",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 12,
    color: "#454545",
    overflowX: "auto",
});
