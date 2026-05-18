import { style } from "@vanilla-extract/css";

export const errorContainer = style({
    padding: "2rem",
    textAlign: "center",
    maxWidth: "600px",
    margin: "4rem auto",
});

export const errorContainerTitle = style({
    fontSize: "2rem",
    marginBottom: "1rem",
});

export const errorContainerMessage = style({
    color: "#94a3b8",
    marginBottom: "1rem",
});

export const errorContainerStack = style({
    textAlign: "left",
    overflow: "auto",
    padding: "1rem",
    background: "#1e293b",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
});

export const notFoundTitle = style({
    fontSize: "3rem",
    marginBottom: "1rem",
});

export const notFoundSubtitle = style({
    marginBottom: "1rem",
});

export const notFoundMessage = style({
    color: "#94a3b8",
    marginBottom: "2rem",
});

export const notFoundLink = style({
    display: "inline-block",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#0891b2",
    color: "#ffffff",
    borderRadius: "0.5rem",
    textDecoration: "none",
    fontWeight: 600,
});
