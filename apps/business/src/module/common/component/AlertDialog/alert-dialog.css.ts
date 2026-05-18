import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const overlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const contentShow = keyframes({
    from: { opacity: 0, transform: "translate(-50%, -48%) scale(0.96)" },
    to: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
});

export const overlay = style({
    backgroundColor: vars.surface.overlay,
    position: "fixed",
    inset: 0,
    animation: `${overlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
});

export const trigger = style({
    cursor: "pointer",
    border: "none",
    padding: 0,
    background: "none",
    textAlign: "left",
    color: "inherit",
});

export const close = style({
    all: "unset",
    position: "absolute",
    top: "15px",
    right: "15px",
    cursor: "pointer",
});

export const content = style({
    backgroundColor: vars.surface.elevated,
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "90vw",
    maxWidth: "850px",
    padding: "15px",
    animation: `${contentShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
    overflowY: "auto",
    borderRadius: alias.cornerRadius.s,
    color: brand.colors.neutral.grey700,
    ":focus": { outline: "none" },
});

export const withCloseButton = style({
    paddingTop: "17px",
});

export const title = style({
    margin: "0 0 20px 0",
    fontWeight: 500,
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: vars.text.primary,
});

export const description = style({
    marginBottom: "14px",
    fontSize: "16px",
    fontWeight: 400,
});

export const footer = style({
    display: "flex",
    justifyContent: "flex-end",
    gap: "14px",
    padding: "15px 0 0 0",
});

export const footerAfter = style({
    padding: "15px 0 0 0",
    textAlign: "center",
});
