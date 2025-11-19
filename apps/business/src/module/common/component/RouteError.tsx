import { Button } from "@frak-labs/ui/component/Button";
import { ErrorBoundary } from "@frak-labs/ui/component/RouteError";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

/**
 * Generic route error component for TanStack Router
 */
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
                        <Button variant="outline">{fallbackLabel}</Button>
                    </Link>
                ) : undefined
            }
        />
    );
}

/**
 * Campaign-specific error component
 */
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

/**
 * Critical operation error component
 */
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

/**
 * Data loading error component
 */
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
