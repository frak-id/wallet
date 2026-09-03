import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { ExclamationFilledIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";

/**
 * Surfaces a permanently-failed pending `ensure`. Mounted in the app shell's
 * `BannerStack`, which every wallet surface renders: the conflict is raised
 * after the page that fired the ensure has navigated away. The stack is a
 * click-through overlay, so the toast never displaces content.
 */
export function EnsureConflictToast() {
    const { t } = useTranslation();
    const raised = ensureConflictStore((state) => state.raised);
    const dismiss = ensureConflictStore((state) => state.dismiss);

    if (!raised) return null;

    return (
        <AlertMessage
            tone="warning"
            icon={<ExclamationFilledIcon width={24} height={24} />}
            title={t("pendingActions.walletAlreadyLinked.title")}
            description={t("pendingActions.walletAlreadyLinked.message")}
            onDismiss={dismiss}
            dismissLabel={t("common.close")}
        />
    );
}
