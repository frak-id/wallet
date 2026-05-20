import { Text } from "@frak-labs/design-system/components/Text";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/module/common/component/Button";
import * as styles from "./route-error.css";

type ErrorBoundaryProps = {
    error: Error;
    reset?: () => void;
    title?: string;
    message?: string;
    showRetry?: boolean;
    showTechnicalDetails?: boolean;
    fallbackAction?: ReactNode;
};

function ErrorBoundary({
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

    const shouldShowTechnicalDetails =
        showTechnicalDetails &&
        process.env.NODE_ENV !== "production" &&
        error.stack;

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
                <Text
                    as="h2"
                    variant="heading2"
                    weight="semiBold"
                    className={styles.title}
                >
                    <span id={titleId}>{title}</span>
                </Text>
                <Text
                    variant="bodySmall"
                    color="secondary"
                    className={styles.message}
                >
                    <span id={messageId}>{errorMessage}</span>
                </Text>

                {shouldShowTechnicalDetails && (
                    <details className={styles.details}>
                        <summary className={styles.detailsSummary}>
                            Technical Details (Development Only)
                        </summary>
                        <pre className={styles.stack}>{error.stack}</pre>
                    </details>
                )}

                <div className={styles.actions}>
                    {showRetry && reset ? (
                        <Button
                            onClick={reset}
                            variant="primary"
                            width="auto"
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

export function RouteError({
    error,
    reset,
    title = "Something went wrong",
    message,
    fallbackPath,
    fallbackLabel = "Go Back",
    showRetry = true,
    showTechnicalDetails = false,
}: ErrorComponentProps & {
    title?: string;
    message?: string;
    fallbackPath?: string;
    fallbackLabel?: string;
    showRetry?: boolean;
    showTechnicalDetails?: boolean;
}) {
    return (
        <ErrorBoundary
            error={error}
            reset={reset}
            title={title}
            message={message}
            showRetry={showRetry}
            showTechnicalDetails={showTechnicalDetails}
            fallbackAction={
                fallbackPath ? (
                    <Link to={fallbackPath}>
                        <Button variant="secondary" width="auto">
                            {fallbackLabel}
                        </Button>
                    </Link>
                ) : undefined
            }
        />
    );
}

export function CampaignError({
    error,
    reset,
    showTechnicalDetails = false,
}: ErrorComponentProps & { showTechnicalDetails?: boolean }) {
    return (
        <RouteError
            error={error}
            reset={reset}
            title="Campaign Not Found"
            message="The campaign you're looking for doesn't exist or you don't have access to it."
            fallbackPath="/campaigns/list"
            fallbackLabel="Back to Campaigns"
            showRetry={false}
            showTechnicalDetails={showTechnicalDetails}
        />
    );
}

export function CriticalError({
    error,
    reset,
    showTechnicalDetails = false,
}: ErrorComponentProps & { showTechnicalDetails?: boolean }) {
    return (
        <RouteError
            error={error}
            reset={reset}
            title="Critical Error"
            message="A critical error occurred. Please try again or contact support if the problem persists."
            fallbackPath="/dashboard"
            fallbackLabel="Go to Dashboard"
            showRetry={true}
            showTechnicalDetails={showTechnicalDetails}
        />
    );
}

export function DataLoadError({
    error,
    reset,
    resourceName = "data",
    showTechnicalDetails = false,
}: ErrorComponentProps & {
    resourceName?: string;
    showTechnicalDetails?: boolean;
}) {
    return (
        <RouteError
            error={error}
            reset={reset}
            title="Failed to Load Data"
            message={`Unable to load ${resourceName}. Please check your connection and try again.`}
            showRetry={true}
            showTechnicalDetails={showTechnicalDetails}
        />
    );
}
