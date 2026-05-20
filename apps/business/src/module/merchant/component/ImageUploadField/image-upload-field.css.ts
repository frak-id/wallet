import { globalStyle, style } from "@vanilla-extract/css";

export const inputRow = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
});

export const clearButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    flexShrink: 0,
    cursor: "pointer",
    borderRadius: "6px",
    fontSize: "14px",
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

export const dropzone = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "320px",
    minHeight: "64px",
    padding: "12px 16px",
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

export const success = style({
    margin: 0,
    fontSize: "13px",
    color: "#00a854",
});

export const existingFiles = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const existingFilesLabel = style({
    margin: 0,
    fontSize: "12px",
    color: "#858d9d",
});

export const existingFileButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    borderRadius: "6px",
    border: "2px solid #e0e2e7",
    backgroundColor: "#f9f9fc",
    cursor: "pointer",
    overflow: "hidden",
    transition: "border-color 0.2s",
    selectors: {
        "&:hover": {
            borderColor: "#5c59e8",
        },
    },
});

globalStyle(`${existingFileButton} img`, {
    width: "100%",
    height: "100%",
    objectFit: "contain",
});
