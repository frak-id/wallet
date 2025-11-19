import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../Button";
import styles from "./index.module.css";

export type ErrorBoundaryProps = {
    error: Error;
    reset?: () => void;
    title?: string;
    message?: string;
    showRetry?: boolean;
    showTechnicalDetails?: boolean;
    fallbackAction?: ReactNode;
};

/**
 * Generic error boundary component
 * Provides consistent error UI with retry and custom action options
 */
export function ErrorBoundary({
    error,
    reset,
    title = "Something went wrong",
    message,
    showRetry = true,
    showTechnicalDetails = false,
    fallbackAction,
}: ErrorBoundaryProps) {
    const errorMessage =
        message || error.message || "An unexpected error occurred";

    // Only show technical details in development mode
    const shouldShowTechnicalDetails =
        showTechnicalDetails &&
        process.env.NODE_ENV !== "production" &&
        error.stack;

    // Generate unique IDs for ARIA relationships
    const titleId = "error-title";
    const messageId = "error-message";

    return (
        <div className={styles.routeError}>
            <div
                className={styles.content}
                role="alert"
                aria-live="assertive"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                tabIndex={-1}
            >
                <div className={styles.icon} aria-hidden="true">
                    <AlertTriangle size={40} strokeWidth={2} />
                </div>
                <h2 id={titleId} className={styles.title}>
                    {title}
                </h2>
                <p id={messageId} className={styles.message}>
                    {errorMessage}
                </p>

                {shouldShowTechnicalDetails && (
                    <details className={styles.details}>
                        <summary>Technical Details (Development Only)</summary>
                        <pre className={styles.stack}>{error.stack}</pre>
                    </details>
                )}

                <div className={styles.actions}>
                    {showRetry && reset ? (
                        <Button
                            onClick={reset}
                            variant="submit"
                            aria-label="Try again to reload this content"
                        >
                            Try Again
                        </Button>
                    ) : null}
                    {fallbackAction}
                </div>
            </div>
        </div>
    );
}
