import type { ReactNode } from "react";
import * as styles from "./floating-phone-preview.css";

/**
 * Pins a phone preview beside an immersive edit page.
 * - `fixed` (default): centered against the viewport, always visible.
 * - `sticky`: a flex item beside the form that follows the scroll and stops
 *   at the form's bottom. Render inside a flex row.
 *
 * Both modes hide on windows too small to fit the phone next to the form.
 */
export function FloatingPhonePreview({
    children,
    variant = "fixed",
}: {
    children: ReactNode;
    variant?: "fixed" | "sticky";
}) {
    return (
        <div className={variant === "sticky" ? styles.sticky : styles.fixed}>
            {children}
        </div>
    );
}
