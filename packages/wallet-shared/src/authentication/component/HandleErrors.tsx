import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import styles from "./HandleErrors.module.css";

type HandleErrorsProps = {
    error: Error;
    /** Optional class to override error text styling (e.g. design system color token) */
    className?: string;
};

const cancellationNames = new Set(["NotAllowedError", "AbortError"]);
const cancellationMessages = ["cancel", "aborted", "error 1001"];

/**
 * Walk the error `.cause` chain to detect user cancellation.
 *
 * Cancellation errors get wrapped differently per platform:
 *  - Web: Ox wraps DOMException{NotAllowedError} → CreateFailedError/SignFailedError
 *  - Firefox: same but DOMException{AbortError}
 *  - iOS Tauri: Ox → BaseError → Error("The operation was canceled.")
 *  - Android Tauri: Ox → BaseError → Error("...cancel...")
 */
export function isUserCancellation(error: Error): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current; depth++) {
        if (current instanceof Error) {
            if (cancellationNames.has(current.name)) return true;
            if (
                cancellationMessages.some(
                    (pattern) =>
                        current instanceof Error &&
                        current.message.toLowerCase().includes(pattern)
                )
            ) {
                return true;
            }
        }
        current = current instanceof Error ? current.cause : undefined;
    }
    return false;
}

export function HandleErrors({ error, className }: HandleErrorsProps) {
    if (isUserCancellation(error)) {
        return <ErrorNotAllowed className={className} />;
    }

    if (error.name === "UserOperationExecutionError") {
        return <ErrorUserOperationExecution className={className} />;
    }

    // Show a generic error
    return <GenericError className={className} />;
}

/**
 * Error when the user cancel the authentication process
 * @returns The error message
 */
function ErrorNotAllowed({ className }: { className?: string }) {
    const { t } = useTranslation();
    return (
        <ErrorWrapper className={className}>
            {t("error.webauthn.notAllowed")}
        </ErrorWrapper>
    );
}

/**
 * Error when the user transaction execution fails
 * @returns The error message
 */
function ErrorUserOperationExecution({ className }: { className?: string }) {
    const { t } = useTranslation();
    return (
        <ErrorWrapper className={className}>
            {t("error.webauthn.userOperationExecution")}
        </ErrorWrapper>
    );
}

/**
 * Generic error
 * @returns The error message
 */
function GenericError({ className }: { className?: string }) {
    const { t } = useTranslation();
    return (
        <ErrorWrapper className={className}>
            {t("error.webauthn.generic")}
        </ErrorWrapper>
    );
}

/**
 * Wrapper for the error message
 * @param children - The children to render
 * @returns The error message
 */
function ErrorWrapper({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <p className={clsx("error", styles.errorWrapper__error, className)}>
            {children}
        </p>
    );
}
