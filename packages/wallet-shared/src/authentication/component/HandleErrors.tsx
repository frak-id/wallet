import { Button } from "@frak-labs/design-system/components/Button";
import {
    ClockIcon,
    LockIcon,
    MobileIcon,
    PersonIcon,
    ShieldIcon,
    WarningCircleIcon,
    WarningIcon,
} from "@frak-labs/design-system/icons";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    classifyWebauthnError,
    type WebauthnErrorKind,
} from "../webauthn/errors";
import * as styles from "./HandleErrors.css";

type WebauthnOperation = "login" | "register" | "sign";
type Tone = "neutral" | "warning" | "danger";

type HandleErrorsProps = {
    error: Error;
    /** Optional class appended to the callout root (e.g. design-system color token). */
    className?: string;
    /** Auth context — enables `already-registered`/`no-credential` routing copy. Omit for transaction signing. */
    operation?: WebauthnOperation;
    /** When set, retryable failures render a "Try again" button invoking it. */
    onRetry?: () => void;
};

/**
 * Per-view presentation: a tone (drives the tinted surface + icon color), an
 * icon, and the i18n `baseKey` whose `.title`/`.message` children are rendered.
 * `stepKeys` adds the multi-step passkey-manager guidance below the message.
 */
type ErrorView = {
    tone: Tone;
    icon: ReactNode;
    baseKey: string;
    stepKeys?: string[];
};

const ICON_SIZE = 20;

const GENERIC_VIEW: ErrorView = {
    tone: "danger",
    icon: <WarningCircleIcon width={ICON_SIZE} height={ICON_SIZE} />,
    baseKey: "error.webauthn.generic",
};

function resolveView(kind: WebauthnErrorKind, isAuth: boolean): ErrorView {
    switch (kind) {
        case "sync-failed":
            return {
                tone: "warning",
                icon: <MobileIcon width={ICON_SIZE} height={ICON_SIZE} />,
                baseKey: "error.webauthn.syncFailed",
                stepKeys: [
                    "error.webauthn.syncFailed.step1",
                    "error.webauthn.syncFailed.step2",
                    "error.webauthn.syncFailed.step3",
                ],
            };
        case "no-screen-lock":
            return {
                tone: "warning",
                icon: <LockIcon width={ICON_SIZE} height={ICON_SIZE} />,
                baseKey: "error.webauthn.noScreenLock",
            };
        case "already-registered":
            return isAuth
                ? {
                      tone: "neutral",
                      icon: <PersonIcon width={ICON_SIZE} height={ICON_SIZE} />,
                      baseKey: "error.webauthn.alreadyRegistered",
                  }
                : GENERIC_VIEW;
        case "no-credential":
            return isAuth
                ? {
                      tone: "neutral",
                      icon: <MobileIcon width={ICON_SIZE} height={ICON_SIZE} />,
                      baseKey: "error.webauthn.noCredential",
                  }
                : GENERIC_VIEW;
        case "unsupported":
            return {
                tone: "warning",
                icon: <WarningIcon width={ICON_SIZE} height={ICON_SIZE} />,
                baseKey: "error.webauthn.unsupported",
            };
        case "security":
            return {
                tone: "danger",
                icon: <ShieldIcon width={ICON_SIZE} height={ICON_SIZE} />,
                baseKey: "error.webauthn.generic",
            };
        case "cancelled":
            return {
                tone: "neutral",
                icon: <ClockIcon width={ICON_SIZE} height={ICON_SIZE} />,
                baseKey: "error.webauthn.notAllowed",
            };
        default:
            return GENERIC_VIEW;
    }
}

export function HandleErrors({
    error,
    className,
    operation,
    onRetry,
}: HandleErrorsProps) {
    if (error.name === "UserOperationExecutionError") {
        return (
            <ErrorCallout
                view={{
                    tone: "danger",
                    icon: (
                        <WarningCircleIcon
                            width={ICON_SIZE}
                            height={ICON_SIZE}
                        />
                    ),
                    baseKey: "error.webauthn.userOperationExecution",
                }}
                className={className}
            />
        );
    }

    const { kind, retryable } = classifyWebauthnError(error);
    const isAuth = operation === "login" || operation === "register";

    return (
        <ErrorCallout
            view={resolveView(kind, isAuth)}
            className={className}
            onRetry={retryable ? onRetry : undefined}
        />
    );
}

function ErrorCallout({
    view,
    className,
    onRetry,
}: {
    view: ErrorView;
    className?: string;
    onRetry?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div
            role="alert"
            className={clsx(
                "error",
                styles.container,
                styles.containerTone[view.tone],
                className
            )}
        >
            <div className={styles.header}>
                <span
                    className={clsx(
                        styles.iconWrapper,
                        styles.iconTone[view.tone]
                    )}
                >
                    {view.icon}
                </span>
                <p className={styles.title}>{t(`${view.baseKey}.title`)}</p>
            </div>
            <p className={styles.description}>{t(`${view.baseKey}.message`)}</p>
            {view.stepKeys && (
                <ol className={styles.steps}>
                    {view.stepKeys.map((key) => (
                        <li key={key}>{t(key)}</li>
                    ))}
                </ol>
            )}
            {onRetry && (
                <Button
                    variant="secondary"
                    size="small"
                    onClick={onRetry}
                    className={styles.retryButton}
                >
                    {t("error.webauthn.retry")}
                </Button>
            )}
        </div>
    );
}
