import { StatusBanner } from "@frak-labs/design-system/components/StatusBanner";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";

export function PairingInProgress() {
    const { t } = useTranslation();

    // Don't double up with the actual pairing screen — the user is already
    // confirming the pairing there, so the "pending" hint is redundant.
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const isOnPairingRoute = pathname.startsWith("/pairing");

    // Track the action id we last dismissed locally so the toast can be
    // hidden without touching the underlying pending action — post-auth
    // navigation to /pairing keeps working. The flag naturally resets if a
    // brand-new pending pairing arrives (different id) or on full reload.
    const [dismissedActionId, setDismissedActionId] = useState<string | null>(
        null
    );

    const pendingPairingAction = pendingActionsStore((s) =>
        s.actions.find(
            (a) =>
                a.type === "navigation" &&
                a.to === "/pairing" &&
                !!a.search?.id &&
                a.expiresAt > Date.now()
        )
    );

    const isDismissed =
        !!pendingPairingAction && pendingPairingAction.id === dismissedActionId;

    if (isOnPairingRoute || !pendingPairingAction || isDismissed) return null;

    return (
        <StatusBanner
            title={t("wallet.pairing.pendingPairing.title")}
            description={t("wallet.pairing.pendingPairing.description")}
            role="status"
            onDismiss={() => setDismissedActionId(pendingPairingAction.id)}
            dismissLabel={t("wallet.pairing.pendingPairing.dismissLabel")}
        />
    );
}
