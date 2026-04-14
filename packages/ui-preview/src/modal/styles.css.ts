import { style } from "@vanilla-extract/css";

export const modalPreview = style({
    padding: 40,
    borderRadius: 25,
    textAlign: "center",
    maxWidth: 430,
    background:
        "radial-gradient(75.96% 75.96% at 50.42% 24.04%, #f2f2f2 20%, #3e557e)",
    color: "#1d1d1d",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
});

export const header = style({
    minHeight: 117,
    fontSize: 21,
    fontWeight: 600,
    lineHeight: 1.5,
});

export const headerText = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 29px",
    width: 170,
    height: 85,
    backgroundColor: "#000",
    color: "#fff",
    opacity: 0.3,
    borderRadius: 25,
});

export const text = style({
    margin: "29px 0",
    fontSize: 21,
    fontWeight: 600,
    lineHeight: 1.5,
});

export const button = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    border: "1px solid #ffffff",
    marginBottom: 10,
    padding: 9,
    borderRadius: 11,
    cursor: "default",
    lineHeight: "24px",
    textAlign: "center",
    background: "rgba(245, 245, 245, 0.1)",
    WebkitBackdropFilter: "blur(13px)",
    backdropFilter: "blur(13px)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
});

export const logo = style({
    display: "block",
    margin: "0 auto",
    maxWidth: 170,
    height: "auto",
});
