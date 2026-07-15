import clsx from "clsx";
import type { AriaRole, ReactNode } from "react";
import {
    CheckCircleFilledIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    InfoIcon,
} from "../../icons";
import { Box } from "../Box";
import * as styles from "./index.css";

export type NoticeTone = "info" | "warning" | "error" | "success" | "neutral";
export type NoticeDisplay = "block" | "inline";

// Default icon per tone. Rendered at 16px; override with `icon` to change size.
const toneIcon: Record<NoticeTone, ReactNode> = {
    info: <InfoIcon width={16} height={16} />,
    warning: <ExclamationTriangleIcon width={16} height={16} />,
    error: <ExclamationCircleIcon width={16} height={16} />,
    success: <CheckCircleFilledIcon width={16} height={16} />,
    neutral: <InfoIcon width={16} height={16} />,
} as const;

type NoticeProps = {
    tone?: NoticeTone;
    display?: NoticeDisplay;
    /** `undefined` → tone default icon; `null` → no icon; else render as-is. */
    icon?: ReactNode | null;
    className?: string;
    /** Forwarded to the root so callers can wire `aria-describedby`. */
    id?: string;
    /** ARIA role for the root, e.g. `"alert"` for assertive error messages. */
    role?: AriaRole;
    children: ReactNode;
};

/**
 * Lightweight tone-colored inline/block message. Sits below `AlertMessage` /
 * `StatusBanner` (no title, steps, action, or dismiss) and above `FieldError`
 * (arbitrary children, not just a caption string). The container sets the
 * tone background and default text color; wrap children in their own `<Text
 * color>` when a site's current text color differs from the tone.
 */
export function Notice({
    tone = "info",
    display = "block",
    icon,
    className,
    id,
    role,
    children,
}: NoticeProps) {
    const resolvedIcon = icon === undefined ? toneIcon[tone] : icon;
    return (
        <Box
            id={id}
            role={role}
            className={clsx(
                styles.noticeVariants({ tone, display }),
                className
            )}
        >
            {resolvedIcon ? (
                <span className={styles.icon} aria-hidden>
                    {resolvedIcon}
                </span>
            ) : null}
            <span className={styles.content}>{children}</span>
        </Box>
    );
}
