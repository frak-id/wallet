import type { AlertMessageTone } from "@frak-labs/design-system/components/AlertMessage";
import {
    ErrorFilledIcon,
    ExclamationFilledIcon,
    ExclamationTriangleIcon,
    FaceIdIcon,
} from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import type { WebauthnToastOperation } from "../stores/webauthnErrorToastStore";
import { classifyWebauthnError, type WebauthnErrorKind } from "./errors";

/** Shared sizing for every alert icon (Figma renders them at 24px). */
const iconProps = { width: 24, height: 24 };

/** i18n key for the "retry the ceremony" action link. */
const RETRY_ACTION = "error.webauthn.retry";
/** i18n key for the "log in instead" action link. */
const LOGIN_ACTION = "error.webauthn.login";

/**
 * Presentation for a WebAuthn failure: a tone (tinted surface + icon + action
 * color), a 24px icon, the i18n `baseKey` whose `.title`/`.message` are shown,
 * and an optional `actionKey` — the bottom action link's label, when the kind
 * offers a next step. `stepKeys` adds the multi-step passkey-manager guidance.
 */
export type WebauthnErrorView = {
    tone: AlertMessageTone;
    icon: ReactNode;
    baseKey: string;
    stepKeys?: string[];
    /** i18n key for the action link's label, or undefined when the kind offers none. */
    actionKey?: string;
    /** Whether replaying the same ceremony can plausibly succeed. */
    retryable: boolean;
};

type ViewShape = Omit<WebauthnErrorView, "retryable">;

const GENERIC_VIEW: ViewShape = {
    tone: "danger",
    icon: <ErrorFilledIcon {...iconProps} />,
    baseKey: "error.webauthn.generic",
    actionKey: RETRY_ACTION,
};

function viewForKind(kind: WebauthnErrorKind, isAuth: boolean): ViewShape {
    switch (kind) {
        case "sync-failed":
            return {
                tone: "warning",
                icon: <ExclamationFilledIcon {...iconProps} />,
                baseKey: "error.webauthn.syncFailed",
                stepKeys: [
                    "error.webauthn.syncFailed.step1",
                    "error.webauthn.syncFailed.step2",
                    "error.webauthn.syncFailed.step3",
                ],
                actionKey: RETRY_ACTION,
            };
        case "no-screen-lock":
            return {
                tone: "warning",
                icon: <ExclamationFilledIcon {...iconProps} />,
                baseKey: "error.webauthn.noScreenLock",
                actionKey: RETRY_ACTION,
            };
        case "already-registered":
            return isAuth
                ? {
                      tone: "neutral",
                      icon: <FaceIdIcon {...iconProps} />,
                      baseKey: "error.webauthn.alreadyRegistered",
                      actionKey: LOGIN_ACTION,
                  }
                : GENERIC_VIEW;
        case "no-credential":
            return isAuth
                ? {
                      tone: "warning",
                      icon: <ExclamationFilledIcon {...iconProps} />,
                      baseKey: "error.webauthn.noCredential",
                  }
                : GENERIC_VIEW;
        case "unsupported":
            return {
                tone: "danger",
                icon: <ExclamationTriangleIcon {...iconProps} />,
                baseKey: "error.webauthn.unsupported",
            };
        case "cancelled":
            return {
                tone: "warning",
                icon: <ExclamationFilledIcon {...iconProps} />,
                baseKey: "error.webauthn.notAllowed",
                actionKey: RETRY_ACTION,
            };
        default:
            return GENERIC_VIEW;
    }
}

/**
 * Resolve the toast presentation for any thrown WebAuthn/transaction error.
 * `operation` enables the auth-only `already-registered`/`no-credential` copy;
 * omit it for transaction signing.
 */
export function resolveWebauthnErrorView(
    error: Error,
    operation?: WebauthnToastOperation
): WebauthnErrorView {
    if (error.name === "UserOperationExecutionError") {
        return {
            tone: "danger",
            icon: <ErrorFilledIcon {...iconProps} />,
            baseKey: "error.webauthn.userOperationExecution",
            actionKey: RETRY_ACTION,
            retryable: false,
        };
    }

    const { kind, retryable } = classifyWebauthnError(error);
    const isAuth = operation === "login" || operation === "register";
    return { ...viewForKind(kind, isAuth), retryable };
}
