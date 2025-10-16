import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import styles from "./HandleErrors.module.css";

type HandleErrorsProps = {
    error: Error;
};

/**
 * Handle messages errors
 * @param error - The error
 * @constructor
 */
export function HandleErrors({ error }: HandleErrorsProps) {
    // AbortError is thrown by Firefox only when the user cancels the authentication process
    if (error.name === "NotAllowedError" || error.name === "AbortError") {
        return <ErrorNotAllowed />;
    }

    // UserOperationExecutionError is thrown when the user transaction execution fails
    if (error.name === "UserOperationExecutionError") {
        return <ErrorUserOperationExecution />;
    }

    // Show a generic error
    return <GenericError />;
}

/**
 * Error when the user cancel the authentication process
 * @returns The error message
 */
function ErrorNotAllowed() {
    const { t } = useTranslation();
    return <ErrorWrapper>{t("error.webauthn.notAllowed")}</ErrorWrapper>;
}

/**
 * Error when the user transaction execution fails
 * @returns The error message
 */
function ErrorUserOperationExecution() {
    const { t } = useTranslation();
    return (
        <ErrorWrapper>
            {t("error.webauthn.userOperationExecution")}
        </ErrorWrapper>
    );
}

/**
 * Generic error
 * @returns The error message
 */
function GenericError() {
    const { t } = useTranslation();
    return <ErrorWrapper>{t("error.webauthn.generic")}</ErrorWrapper>;
}

/**
 * Wrapper for the error message
 * @param children - The children to render
 * @returns The error message
 */
function ErrorWrapper({ children }: PropsWithChildren) {
    return <p className={`error ${styles.errorWrapper__error}`}>{children}</p>;
}
