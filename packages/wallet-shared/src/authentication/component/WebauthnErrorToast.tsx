import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { useTranslation } from "react-i18next";
import { useWebauthnErrorToastStore } from "../stores/webauthnErrorToastStore";
import { resolveWebauthnErrorView } from "../webauthn/errorView";

/**
 * Renders the active WebAuthn error toast from the global store, or nothing when
 * there is none. Mounted once inside the app's top `BannerStack`; auth flows
 * raise errors into the store via `useWebauthnErrorToast`. Persists until the
 * user dismisses it or triggers the retry action.
 */
export function WebauthnErrorToast() {
    const current = useWebauthnErrorToastStore((state) => state.current);
    const dismiss = useWebauthnErrorToastStore((state) => state.dismiss);
    const { t } = useTranslation();

    if (!current) return null;

    const view = resolveWebauthnErrorView(current.error, current.operation);
    const { onRetry } = current;
    const action =
        view.actionKey && onRetry
            ? {
                  label: t(view.actionKey),
                  onClick: () => {
                      onRetry();
                      dismiss(current.id);
                  },
              }
            : undefined;

    return (
        <AlertMessage
            tone={view.tone}
            icon={view.icon}
            title={t(`${view.baseKey}.title`)}
            description={t(`${view.baseKey}.message`)}
            steps={view.stepKeys?.map((key) => t(key))}
            action={action}
            onDismiss={() => dismiss(current.id)}
            dismissLabel={t("error.webauthn.dismiss")}
        />
    );
}
