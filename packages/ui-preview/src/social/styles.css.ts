import { style } from "@vanilla-extract/css";

export const socialPreview = style({
    padding: 20,
    backgroundColor: "#0b141a",
});

export const chatArea = style({
    margin: "0 auto",
    paddingBottom: 20,
});

export const messageBubble = style({
    backgroundColor: "#202c33",
    borderRadius: 8,
    padding: "8px 12px",
    margin: "8px 0",
    maxWidth: "70%",
    position: "relative",
    color: "#e9edef",
    fontSize: 14,
    lineHeight: 1.4,
    wordWrap: "break-word",
});

export const messageLink = style({
    color: "#00a884",
    textDecoration: "none",
});

export const inputContainer = style({
    backgroundColor: "#202c33",
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    gap: 10,
});

const circleButton = style({
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "transparent",
    border: "none",
    color: "#8696a0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    selectors: {
        "&:hover": {
            backgroundColor: "#2a3942",
        },
    },
});

export const addButton = style([
    circleButton,
    {
        fontSize: 24,
    },
]);

export const emojiButton = style([
    circleButton,
    {
        fontSize: 20,
    },
]);

export const sendButton = style({
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#00a884",
    border: "none",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    selectors: {
        "&:hover": {
            backgroundColor: "#06cf9c",
        },
    },
});

export const messageInput = style({
    flex: 1,
    backgroundColor: "#2a3942",
    border: "none",
    borderRadius: 20,
    padding: "10px 16px",
    color: "#e9edef",
    fontSize: 14,
    outline: "none",
    "::placeholder": {
        color: "#8696a0",
    },
});
