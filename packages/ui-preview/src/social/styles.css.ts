import { style } from "@vanilla-extract/css";

/**
 * Third-party chat colours and densities, not DS tokens: a Frak token change
 * must never restyle the app being impersonated. Same call as `explorer-phone`.
 */
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

/** The URL as printed in the message body — coloured like a link, but inert. */
export const messageUrl = style({
    color: "#00a884",
});

/**
 * Unfurled link card. Sits inside the bubble, above the message text, in the
 * darker treatment WhatsApp gives a link preview.
 */
export const linkCard = style({
    backgroundColor: "#1f2c34",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 6,
});

export const linkCardImage = style({
    display: "block",
    width: "100%",
    // Cap the band so a tall logo cannot outgrow the message it belongs to.
    maxHeight: 140,
    // `contain`, as every other merchant-logo render: a square logo must not
    // lose its top and bottom to a crop. The dark backdrop letterboxes it.
    objectFit: "contain",
    backgroundColor: "#0b141a",
});

export const linkCardBody = style({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "6px 10px",
});

export const linkCardTitle = style({
    color: "#e9edef",
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.3,
    // Two lines, then ellipsis: the receiving app clamps too.
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
});

export const linkCardHost = style({
    color: "#8696a0",
    fontSize: 12,
    lineHeight: 1.3,
});

/** Message text under the card. Margin reset: the card already spaces it. */
export const messageBody = style({
    margin: 0,
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
    color: "#8696a0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
});

/** Drawn input: a `div`, so the placeholder is real text, not `::placeholder`. */
export const messageInput = style({
    flex: 1,
    backgroundColor: "#2a3942",
    borderRadius: 20,
    padding: "10px 16px",
    color: "#8696a0",
    fontSize: 14,
});
