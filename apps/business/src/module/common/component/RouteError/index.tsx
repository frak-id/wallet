import { Text } from "@frak-labs/design-system/components/Text";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
    title,
    message,
    showRetry = true,
    showTechnicalDetails = false,
    fallbackAction,
}: ErrorBoundaryProps) {
    const { t } = useTranslation();
    const resolvedTitle = title ?? t("errors.generic.title");
    const errorMessage =
        message || error.message || t("errors.boundary.message");

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
                    <span id={titleId}>{resolvedTitle}</span>
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
                            {t("errors.boundary.technicalDetails")}
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
                            aria-label={t("errors.boundary.retryAria")}
                        >
                            {t("errors.boundary.retry")}
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
    title,
    message,
    fallbackPath,
    fallbackLabel,
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
    const { t } = useTranslation();
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
                            {fallbackLabel ?? t("errors.boundary.goBack")}
                        </Button>
                    </Link>
                ) : undefined
            }
        />
    );
}

export function CampaignError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.campaign.title")}
            message={t("errors.campaign.message")}
            fallbackPath="/campaigns/list"
            fallbackLabel={t("errors.campaign.back")}
            showRetry={false}
        />
    );
}

export function CriticalError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.critical.title")}
            message={t("errors.critical.message")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.critical.back")}
            showRetry={true}
        />
    );
}

export function MerchantNotFoundError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.merchantNotFound.title")}
            message={t("errors.merchantNotFound.message")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.merchantNotFound.back")}
            showRetry={false}
        />
    );
}

export function MerchantCreateError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.merchantCreate.title")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.merchantCreate.back")}
        />
    );
}

export function CampaignCreateError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.campaignCreate.title")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.campaignCreate.back")}
        />
    );
}

export function DataLoadError({
    resourceName = "data",
    ...props
}: ErrorComponentProps & {
    resourceName?: string;
}) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.dataLoad.title")}
            message={t("errors.dataLoad.message", { resourceName })}
            showRetry={true}
        />
    );
}
