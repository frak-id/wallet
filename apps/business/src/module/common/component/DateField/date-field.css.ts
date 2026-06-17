import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Muted field shell: typeable date input + calendar-popover trigger. */
export const dateField = style({
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    width: "100%",
    height: "56px",
    padding: `0 ${alias.spacing.m}`,
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
});

/** Invalid state — fills the field with the error surface. */
export const dateFieldError = style({
    backgroundColor: vars.surface.error,
});

export const dateFieldDisabled = style({
    opacity: 0.6,
});

/** The dd/mm/yyyy text input filling the field. */
export const dateInput = style({
    all: "unset",
    flex: 1,
    minWidth: 0,
    fontSize: "16px",
    lineHeight: "26px",
    color: vars.text.primary,
    selectors: {
        "&::placeholder": { color: vars.text.disabled, opacity: 1 },
        "&:disabled": { cursor: "not-allowed" },
    },
});

/** Calendar icon button (opens the popover). */
export const dateIconButton = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    cursor: "pointer",
    selectors: {
        "&:disabled": { cursor: "not-allowed" },
    },
});

export const dateIcon = style({
    color: vars.icon.secondary,
    flexShrink: 0,
});
