import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/**
 * Elevated auth-card surface. The DS `Card` provides the background + radius
 * but no shadow, so we add a soft float (mirrors the login screenshot card)
 * and a hairline border for definition on the light hero background.
 */
export const card = style({
    padding: "28px",
    border: `1px solid ${vars.border.subtle}`,
    boxShadow: "0px 16px 48px 0px rgba(0, 0, 0, 0.08)",
});
