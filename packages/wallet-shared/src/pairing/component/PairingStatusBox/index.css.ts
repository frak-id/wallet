import { style, styleVariants } from "@vanilla-extract/css";

export const statusBox = style({
    display: "flex",
    gap: "5px",
});

const statusBoxContainerBase = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "5px",
    marginLeft: "8px",
});

export const statusBoxModalContainer = style([statusBoxContainerBase, {}]);

export const statusBoxWalletEmbeddedContainer = style([
    statusBoxContainerBase,
    {
        color: "#fff",
    },
]);

export const statusBox__indicator = style({
    marginTop: "4px",
    width: "10px",
    height: "10px",
    borderRadius: "var(--frak-radius-full)",
});

export const statusBoxIndicatorColor = styleVariants({
    green: { backgroundColor: "#22c55e" },
    amber: { backgroundColor: "#f59e0b" },
    red: { backgroundColor: "#dc2626" },
});

export const statusBox__content = style({
    display: "flex",
    flexDirection: "column",
});

export const statusBox__title = style({
    fontSize: "12px",
    fontWeight: 500,
});

export const statusBox__retry = style({
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: "inherit",
});

export const statusBox__retryText = style({
    fontSize: "12px",
});

export const statusBox__retryTextItem = style({
    display: "block",
    textAlign: "left",
});
