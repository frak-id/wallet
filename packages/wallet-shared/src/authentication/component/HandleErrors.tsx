import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { useTranslation } from "react-i18next";
import type { WebauthnToastOperation } from "../stores/webauthnErrorToastStore";
import { resolveWebauthnErrorView } from "../webauthn/errorView";

type HandleErrorsProps = {
    error: Error;
    /** Optional class appended to the callout root. */
    className?: string;
    /** Auth context — enables `already-registered`/`no-credential` routing copy. Omit for signing. */
    operation?: WebauthnToastOperation;
    /** When set, retryable failures render a "Try again" action invoking it. */
    onRetry?: () => void;
};

/**
 * Inline WebAuthn error callout — renders the shared `AlertMessage` card without
 * a dismiss control. It is used on surfaces that lack the top toast, such as the
 * listener iframe modals; the wallet app shows the same errors as a dismissible
 * top toast via `useWebauthnErrorToast`.
 */
export function HandleErrors({
    error,
    className,
    operation,
    onRetry,
}: HandleErrorsProps) {
    const { t } = useTranslation();
    const view = resolveWebauthnErrorView(error, operation);
    const action =
        view.actionKey && onRetry
            ? { label: t(view.actionKey), onClick: onRetry }
            : undefined;

    return (
        <AlertMessage
            tone={view.tone}
            icon={view.icon}
            title={t(`${view.baseKey}.title`)}
            description={t(`${view.baseKey}.message`)}
            steps={view.stepKeys?.map((key) => t(key))}
            action={action}
            className={className}
        />
    );
}
