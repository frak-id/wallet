import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import styles from "./HandleErrors.module.css";

type HandleErrorsProps = {
    error: Error;
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

export function HandleErrors({ error }: HandleErrorsProps) {
    if (isUserCancellation(error)) {
        return <ErrorNotAllowed />;
    }

    if (error.name === "UserOperationExecutionError") {
        return <ErrorUserOperationExecution />;
    }

    return <GenericError />;
}

function ErrorNotAllowed() {
    const { t } = useTranslation();
    return <ErrorWrapper>{t("error.webauthn.notAllowed")}</ErrorWrapper>;
}

function ErrorUserOperationExecution() {
    const { t } = useTranslation();
    return (
        <ErrorWrapper>
            {t("error.webauthn.userOperationExecution")}
        </ErrorWrapper>
    );
}

function GenericError() {
    const { t } = useTranslation();
    return <ErrorWrapper>{t("error.webauthn.generic")}</ErrorWrapper>;
}

function ErrorWrapper({ children }: PropsWithChildren) {
    return <p className={`error ${styles.errorWrapper__error}`}>{children}</p>;
}
