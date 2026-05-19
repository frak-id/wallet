import { globalStyle, style } from "@vanilla-extract/css";

export const list = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const item = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    border: "1px solid #e0e2e7",
    borderRadius: "6px",
    backgroundColor: "#f9f9fc",
});

export const thumb = style({
    width: "48px",
    height: "32px",
    flexShrink: 0,
    borderRadius: "4px",
    overflow: "hidden",
    backgroundColor: "#f9f9fc",
});

globalStyle(`${thumb} img`, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const url = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    color: "#858d9d",
});

export const deleteButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    flexShrink: 0,
    cursor: "pointer",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#858d9d",
    border: "1px solid #e0e2e7",
    backgroundColor: "#f9f9fc",
    transition: "all 0.2s",
    selectors: {
        "&:hover": {
            color: "#d11a2a",
            borderColor: "#f79ea9",
            backgroundColor: "#fff5f6",
        },
    },
});

export const preview = style({
    position: "absolute",
    left: "60px",
    top: "calc(100% + 6px)",
    zIndex: 10,
    pointerEvents: "none",
    width: "280px",
    height: "160px",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid #e0e2e7",
    backgroundColor: "#f9f9fc",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
});

globalStyle(`${preview} img`, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const dropzone = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "320px",
    minHeight: "48px",
    padding: "10px 16px",
    border: "2px dashed #e0e2e7",
    borderRadius: "8px",
    backgroundColor: "#f9f9fc",
    cursor: "pointer",
    transition: "border-color 0.2s, background-color 0.2s",
    selectors: {
        "&:hover": {
            borderColor: "#5c59e8",
        },
    },
});

export const dropzoneActive = style({
    borderColor: "#5c59e8",
    backgroundColor: "color-mix(in srgb, #5c59e8 8%, transparent)",
});

export const dropzonePending = style({
    opacity: 0.6,
    cursor: "wait",
});

export const dropzoneText = style({
    fontSize: "13px",
    color: "#858d9d",
    textAlign: "center",
});

export const restrictions = style({
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.4,
    color: "#858d9d",
});

export const error = style({
    margin: 0,
    fontSize: "13px",
    color: "#d11a2a",
});
