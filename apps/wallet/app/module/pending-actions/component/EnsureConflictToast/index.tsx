import { useTranslation } from "react-i18next";
import { Toast } from "@/module/common/component/Toast";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";

/**
 * Surfaces a permanently-failed pending `ensure`. Mounted on every surface
 * that can fire one — the wallet layout and the standalone install entry —
 * because the conflict is raised after that page has navigated away.
 */
export function EnsureConflictToast() {
    const { t } = useTranslation();
    const raised = ensureConflictStore((state) => state.raised);
    const dismiss = ensureConflictStore((state) => state.dismiss);

    if (!raised) return null;

    return (
        <Toast
            text={t("pendingActions.walletAlreadyLinked")}
            onDismiss={dismiss}
            ariaDismissLabel={t("common.close")}
        />
    );
}
