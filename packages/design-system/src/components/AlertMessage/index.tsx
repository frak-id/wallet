import clsx from "clsx";
import {
    type ReactNode,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import { CloseIcon } from "../../icons";
import * as styles from "./alertMessage.css";

export type AlertMessageTone = "neutral" | "warning" | "danger";

type AlertMessageAction = {
    label: string;
    onClick: () => void;
};

type AlertMessageProps = {
    /** Drives the tinted surface, icon color and action-link color. */
    tone: AlertMessageTone;
    /** 24px tone-colored icon (rendered with `currentColor`). */
    icon: ReactNode;
    title: string;
    description?: ReactNode;
    /** Numbered guidance rendered as an ordered list below the description. */
    steps?: string[];
    /** Tone-colored text action pinned below the message (e.g. "Try again"). */
    action?: AlertMessageAction;
    /** When set, renders the trailing close (X) button. */
    onDismiss?: () => void;
    /** Accessible label for the close button — required when `onDismiss` is set. */
    dismissLabel?: string;
    /** Extra class(es) appended to the root container. */
    className?: string;
};

/**
 * Tracks whether a scroll container overflows past its top/bottom edges so the
 * caller can toggle the gradient fade overlays. Re-measures on scroll and on
 * content/size changes via `ResizeObserver`.
 */
function useScrollEdges(ref: RefObject<HTMLElement | null>) {
    const [edges, setEdges] = useState({ top: false, bottom: false });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const overflowing = el.scrollHeight > el.clientHeight + 1;
            const atTop = el.scrollTop <= 1;
            const atBottom =
                el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            const next = {
                top: overflowing && !atTop,
                bottom: overflowing && !atBottom,
            };
            setEdges((prev) =>
                prev.top === next.top && prev.bottom === next.bottom
                    ? prev
                    : next
            );
        };

        update();
        el.addEventListener("scroll", update, { passive: true });
        const observer =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(update)
                : null;
        observer?.observe(el);

        return () => {
            el.removeEventListener("scroll", update);
            observer?.disconnect();
        };
    }, [ref]);

    return edges;
}

/**
 * Pixel-perfect Figma "Alert message" card (compact + scrollable variants).
 * Presentational only — used as the WebAuthn error toast inside `BannerStack`,
 * and inline for terminal error fallbacks. The close button stays pinned while
 * the content scrolls beneath it, with edge-fade overlays signalling overflow.
 */
export function AlertMessage({
    tone,
    icon,
    title,
    description,
    steps,
    action,
    onDismiss,
    dismissLabel,
    className,
}: AlertMessageProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const edges = useScrollEdges(scrollRef);

    return (
        <div
            role="alert"
            className={clsx(
                styles.container,
                styles.containerTone[tone],
                className
            )}
        >
            <div ref={scrollRef} className={styles.scrollArea}>
                <div className={styles.row}>
                    <span className={clsx(styles.icon, styles.iconTone[tone])}>
                        {icon}
                    </span>
                    <div className={styles.textColumn}>
                        <div className={styles.titleRow}>
                            <p className={styles.title}>{title}</p>
                        </div>
                        {description != null && (
                            <p className={styles.description}>{description}</p>
                        )}
                        {steps && steps.length > 0 && (
                            <ol className={styles.steps}>
                                {steps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
                {action && (
                    <div className={styles.bottom}>
                        <button
                            type="button"
                            className={clsx(
                                styles.action,
                                styles.actionTone[tone]
                            )}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </button>
                    </div>
                )}
            </div>

            <div
                className={clsx(
                    styles.fade,
                    styles.fadeTop,
                    styles.fadeTone[tone],
                    edges.top && styles.fadeVisible
                )}
            />
            <div
                className={clsx(
                    styles.fade,
                    styles.fadeBottom,
                    styles.fadeTone[tone],
                    edges.bottom && styles.fadeVisible
                )}
            />

            {onDismiss && (
                <button
                    type="button"
                    className={styles.close}
                    onClick={onDismiss}
                    aria-label={dismissLabel}
                >
                    <CloseIcon width={24} height={24} />
                </button>
            )}
        </div>
    );
}
