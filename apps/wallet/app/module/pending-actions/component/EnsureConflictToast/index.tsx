import { useTranslation } from "react-i18next";
import { Toast } from "@/module/common/component/Toast";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";

/**
 * Surfaces a permanently-failed pending `ensure` (README §3.8). Without it
 * a WALLET_ALREADY_LINKED conflict retried silently on every app launch for
 * the full 7-day pending-action TTL, with nothing the user could see or
 * report.
 *
 * Rendered from the persistent wallet layout because the conflict is raised
 * asynchronously, after the page that triggered the ensure has navigated
 * away.
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
