import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { ExclamationFilledIcon } from "@frak-labs/design-system/icons";
import { useOnlineStatus } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { modalErrorStore } from "@/module/stores/modalErrorStore";

/**
 * Surfaces a modal that could not be loaded. Mounted in the app shell's
 * `BannerStack`: the modal has already closed by this point, so without a
 * toast the user taps into nothing and has no way to learn why.
 */
export function ModalErrorToast() {
    const { t } = useTranslation();
    const isOnline = useOnlineStatus();
    const raised = modalErrorStore((state) => state.raised);
    const dismiss = modalErrorStore((state) => state.dismiss);

    if (!raised) return null;

    // Offline is the other way a chunk fails to arrive, and telling that user
    // the app was updated sends them to reload into the same failure.
    const message = isOnline
        ? t("wallet.modalError.message")
        : t("wallet.modalError.messageOffline");

    return (
        <AlertMessage
            tone="warning"
            icon={<ExclamationFilledIcon width={24} height={24} />}
            title={t("wallet.modalError.title")}
            description={message}
            action={
                isOnline
                    ? {
                          label: t("wallet.modalError.reload"),
                          // A stale chunk resolves only on a fresh load:
                          // assets are immutable and the service worker
                          // caches none of them.
                          onClick: () => location.reload(),
                      }
                    : undefined
            }
            onDismiss={dismiss}
            dismissLabel={t("common.close")}
        />
    );
}
