import {
    globalStyle,
    keyframes,
    style,
    styleVariants,
} from "@vanilla-extract/css";

export const modalListener__header = style({
    marginBottom: "20px",
});

export const modalListener__content = style({
    transform: "translateZ(0)",
});

export const modalListener__title = style({
    fontSize: "16px",
    textAlign: "left",
    fontWeight: 700,
});

export const modalListener__subTitle = style({
    marginBottom: "10px",
    fontWeight: 600,
});

export const modalListener__text = style({
    margin: "4px 0px",
});

export const modalListener__success = style({
    textAlign: "center",
    color: "var(--frak-color-green)",
});

export const modalListener__steps = style({
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    marginBottom: "20px",
    padding: "4px",
});

export const modalListener__stepNumber = style({
    position: "relative",
    display: "inline-flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
});

export const modalListener__stepNumberInnerIcon = style({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    backgroundColor: "#fff",
    color: "#818c9c",
    borderRadius: "50%",
    border: "2px solid #818c9c",
});

const highlightLastStepKf = keyframes({
    "60%": { color: "#818c9c", borderColor: "#818c9c" },
    "100%": { color: "#0171ec", borderColor: "#0171ec" },
});

const stepItemBase = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    textAlign: "center",
    color: "#818c9c",
    fontWeight: 500,
    fontSize: "12px",
});

export const modalListener__stepItem = stepItemBase;

/* Replicates the original BEM modifier classes (`--done`, `--active`).
 * Consumers compose `modalListener__stepItem` with whichever modifier
 * applies via `cx(...)` (same pattern as the original CSS module). */
export const stepItemModifier = styleVariants({
    done: {
        color: "#0171ec",
    },
    active: {
        animation: `${highlightLastStepKf} 2s forwards`,
    },
});

/* Pseudo-element connector line between non-last steps */
globalStyle(
    `${stepItemBase}:not(:last-child) ${modalListener__stepNumber}::after`,
    {
        content: '""',
        position: "absolute",
        top: "50%",
        left: "calc(50% + 20px)" /* Start after the icon + margin */,
        width: "calc(100% - 44px)" /* Full width minus the icon width and margin */,
        height: "3px",
        background:
            "radial-gradient(circle, #a1aebe 50%, transparent 50%) repeat-x",
        backgroundSize: "6px 3px",
        transform: "translateY(-50%)",
        zIndex: 0 /* Keeps the line below the step number */,
    }
);

/* Done state: also tint the inner icon */
globalStyle(`${stepItemModifier.done} ${modalListener__stepNumberInnerIcon}`, {
    borderColor: "#0171ec",
    color: "#0171ec",
});

/* Active last-step animation also pulses the inner icon */
globalStyle(
    `${stepItemBase}:last-child${stepItemModifier.active} ${modalListener__stepNumberInnerIcon}`,
    {
        animation: `${highlightLastStepKf} 2s forwards`,
    }
);

export const modalListener__help = style({
    marginTop: "20px",
    fontSize: "12px",
    color: "#818c9c",
});

export const modalListener__buttonsWrapper = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "9px",
    marginTop: "40px",
});

globalStyle(`${modalListener__buttonsWrapper} > div`, {
    flex: 1,
    width: "100%",
    textAlign: "center",
});

const buttonBase = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    maxWidth: "80%",
    border: "1px solid transparent",
    padding: "5px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    lineHeight: "24px",
    textAlign: "center",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});

export const modalListener__buttonPrimary = style([
    buttonBase,
    {
        backgroundColor:
            "var(--frak-alertDialog-button-primary-background-color)",
        color: "var(--frak-alertDialog-button-primary-text-color)",
    },
]);

export const modalListener__buttonSecondary = style([
    buttonBase,
    {
        backgroundColor:
            "var(--frak-alertDialog-button-secondary-background-color)",
        color: "var(--frak-alertDialog-button-secondary-text-color)",
        borderColor: "var(--frak-alertDialog-button-secondary-border-color)",
    },
]);

export const modalListener__sharingButtons = style({
    display: "flex",
    justifyContent: "center",
    gap: "40px",
});

export const modalListener__buttonLink = style({
    all: "unset",
    cursor: "pointer",
    textDecoration: "underline",
    display: "inline-flex",
    gap: "8px",
});

export const modalTitle__provided = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    marginLeft: "auto",
    fontSize: "12px",
    fontStyle: "italic",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
});

export const modalListener__iconContainer = style({
    display: "flex",
    margin: "0 auto 28px auto",
    width: "50%",
    flexDirection: "column",
});

globalStyle(`${modalListener__iconContainer} ${modalTitle__provided}`, {
    alignSelf: "flex-end",
    marginTop: "-4px",
});

export const modalListener__icon = style({
    display: "block",
    width: "100%",
});

export const modalListener__footer = style({
    position: "relative",
    width: "100%",
    marginTop: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
});

export const modalTitle__logo = style({
    height: "22px",
    width: "auto",
});

export const drawerTitle__container = style({
    margin: "12px 0",
    fontSize: "16px",
    textAlign: "left",
    fontWeight: 700,
});

/* === Modal shell styles (ported from deleted wallet-shared/Drawer + WalletModal) === */

const drawerOverlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const dialogOverlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const dialogContentShow = keyframes({
    from: {
        opacity: 0,
        transform: "translate(-50%, -48%) scale(0.96)",
    },
    to: {
        opacity: 1,
        transform: "translate(-50%, -50%) scale(1)",
    },
});

export const drawer__overlay = style({
    background: "rgba(0, 0, 0, 0.2)",
    position: "fixed",
    zIndex: 10,
    inset: 0,
    animation: `${drawerOverlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
});

export const drawer__contentWrapper = style({
    /* Create a new stacking context for the toaster to be inside our modal */
    transform: "translateZ(0)",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: "100dvh",
    marginTop: "24px",
    display: "flex",
    flexDirection: "column",
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    backgroundColor: "var(--frak-drawer-background-color)",
});

export const drawer__content = style({
    padding: "20px",
});

globalStyle(`${drawer__content} > section`, {
    overflow: "auto",
    maxHeight: "91dvh",
});

export const drawer__handle = style({
    margin: "16px auto 0 auto",
    height: "8px",
    width: "100px",
    borderRadius: "var(--frak-radius-full)",
    backgroundColor: "var(--frak-drawer-handle-background-color)",
});

export const alertDialog__overlay = style({
    background: "rgba(0, 0, 0, 0.4)",
    position: "fixed",
    zIndex: 210,
    inset: 0,
    animation: `${dialogOverlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
});

export const alertDialog__close = style({
    all: "unset",
    position: "absolute",
    top: "15px",
    right: "15px",
    cursor: "pointer",
});

export const alertDialog__content = style({
    /* Create a new stacking context for the toaster to be inside our modal */
    transform: "translate(-50%, -50%)",
    backgroundColor: "var(--frak-alertDialog-background-color)",
    backdropFilter: "blur(85px)",
    position: "fixed",
    top: "50%",
    left: "50%",
    zIndex: 220,
    width: "90vw",
    maxWidth: "420px",
    padding: "15px",
    animation: `${dialogContentShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
    overflowY: "auto",
    borderRadius: "var(--frak-radius-l)",
    color: "#fff",
    selectors: {
        "&:focus": {
            outline: "none",
        },
    },
});

globalStyle(`${alertDialog__content} a`, {
    color: "#007aff",
});

export const alertDialog__withCloseButton = style({
    paddingTop: "17px",
});

export const alertDialog__title = style({
    margin: "0 0 20px 0",
    fontWeight: 700,
    fontSize: "16px",
});

export const alertDialog__description = style({
    marginTop: "30px",
});
