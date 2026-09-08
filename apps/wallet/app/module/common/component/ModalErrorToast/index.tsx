import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { ExclamationFilledIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { modalErrorStore } from "@/module/stores/modalErrorStore";

/**
 * Surfaces a modal that could not be loaded. Mounted in the app shell's
 * `BannerStack`: the modal has already closed by this point, so without a
 * toast the user taps into nothing and has no way to learn why.
 */
export function ModalErrorToast() {
    const { t } = useTranslation();
    const raised = modalErrorStore((state) => state.raised);
    const dismiss = modalErrorStore((state) => state.dismiss);

    if (!raised) return null;

    return (
        <AlertMessage
            tone="warning"
            icon={<ExclamationFilledIcon width={24} height={24} />}
            title={t("modalError.title")}
            description={t("modalError.message")}
            action={{
                label: t("modalError.reload"),
                // A stale chunk resolves only on a fresh load: assets are
                // immutable and the service worker caches none of them.
                onClick: () => location.reload(),
            }}
            onDismiss={dismiss}
            dismissLabel={t("common.close")}
        />
    );
}
