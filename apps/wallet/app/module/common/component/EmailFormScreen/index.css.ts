import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    paddingInline: alias.spacing.m,
    marginTop: alias.spacing.m,
});

export const labelRow = style({
    paddingInline: alias.spacing.m,
});

export { clearButton } from "@/module/common/styles/touchTarget.css";

export const inlineError = style({
    paddingInline: alias.spacing.m,
});
