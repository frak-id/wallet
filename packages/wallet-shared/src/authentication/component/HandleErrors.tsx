import { Button } from "@frak-labs/design-system/components/Button";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { classifyWebauthnError } from "../webauthn/errors";
import * as styles from "./HandleErrors.css";

type WebauthnOperation = "login" | "register" | "sign";

type HandleErrorsProps = {
    error: Error;
    /** Optional class to override error text styling (e.g. design system color token) */
    className?: string;
    /** Auth context — enables `already-registered`/`no-credential` routing copy. Omit for transaction signing. */
    operation?: WebauthnOperation;
    /** When set, retryable failures render a "Try again" button invoking it. */
    onRetry?: () => void;
};

export function HandleErrors({
    error,
    className,
    operation,
    onRetry,
}: HandleErrorsProps) {
    if (error.name === "UserOperationExecutionError") {
        return (
            <SimpleError
                messageKey="error.webauthn.userOperationExecution"
                className={className}
            />
        );
    }

    const { kind, retryable } = classifyWebauthnError(error);
    const retry = retryable ? onRetry : undefined;
    const isAuth = operation === "login" || operation === "register";

    switch (kind) {
        case "sync-failed":
            return (
                <PasskeyManagerError className={className} onRetry={retry} />
            );
        case "no-screen-lock":
            return (
                <SimpleError
                    messageKey="error.webauthn.noScreenLock"
                    className={className}
                    onRetry={retry}
                />
            );
        case "already-registered":
            return (
                <SimpleError
                    messageKey={
                        isAuth
                            ? "error.webauthn.alreadyRegistered"
                            : "error.webauthn.generic"
                    }
                    className={className}
                />
            );
        case "no-credential":
            return (
                <SimpleError
                    messageKey={
                        isAuth
                            ? "error.webauthn.noCredential"
                            : "error.webauthn.generic"
                    }
                    className={className}
                />
            );
        case "unsupported":
            return (
                <SimpleError
                    messageKey="error.webauthn.unsupported"
                    className={className}
                />
            );
        case "cancelled":
            return (
                <SimpleError
                    messageKey="error.webauthn.notAllowed"
                    className={className}
                    onRetry={retry}
                />
            );
        default:
            return (
                <SimpleError
                    messageKey="error.webauthn.generic"
                    className={className}
                    onRetry={retry}
                />
            );
    }
}

type ViewProps = {
    className?: string;
    onRetry?: () => void;
};

function SimpleError({
    messageKey,
    className,
    onRetry,
}: ViewProps & { messageKey: string }) {
    const { t } = useTranslation();
    return (
        <>
            <p className={clsx("error", styles.errorWrapper, className)}>
                {t(messageKey)}
            </p>
            {onRetry && <RetryButton onRetry={onRetry} />}
        </>
    );
}

function PasskeyManagerError({ className, onRetry }: ViewProps) {
    const { t } = useTranslation();
    return (
        <div className={clsx("error", styles.errorWrapper, className)}>
            <p>{t("error.webauthn.passkeyManager.intro")}</p>
            <ul>
                <li>{t("error.webauthn.passkeyManager.action1")}</li>
                <li>{t("error.webauthn.passkeyManager.action2")}</li>
                <li>{t("error.webauthn.passkeyManager.action3")}</li>
            </ul>
            {onRetry && <RetryButton onRetry={onRetry} />}
        </div>
    );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <Button
            variant="secondary"
            onClick={onRetry}
            className={styles.retryButton}
        >
            {t("error.webauthn.retry")}
        </Button>
    );
}
