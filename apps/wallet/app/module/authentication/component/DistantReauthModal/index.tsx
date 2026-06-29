import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { QrCodeIcon } from "@frak-labs/design-system/icons";
import { getOriginPairingClient, PairingView } from "@frak-labs/wallet-shared";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import { isExpired } from "@frak-labs/wallet-shared/common/utils/tokenExpiry";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/module/authentication/hook/useLogout";
import { ContentBlock } from "@/module/common/component/ContentBlock";

type DistantReauthModalProps = {
    /**
     * Backend-enforced credential allow-list seeded from the dead session's
     * `authenticatorId`. The backend rejects any joiner whose credential is
     * not in this set, so re-pairing is forced to the SAME wallet.
     *
     * Pass from the Zustand modal store (stable reference) — do NOT wrap in a
     * new array literal here, as that would re-fire the initiate effect every
     * render.
     */
    authenticatorHints: string[];
    onClose: () => void;
};

/**
 * Two-phase re-pair prompt shown when a PAIRED (distant-webauthn) session's
 * wallet token is server-confirmed dead.
 *
 * A paired session's passkey lives on another device, so a local biometric
 * re-auth is impossible. Instead this modal:
 *   - Phase 1: Explains the situation and shows a "Reconnect" button.
 *     Mounting the modal does NOT touch the shared `OriginPairingClient`
 *     singleton — this avoids tearing down any in-flight user-driven pairing.
 *   - Phase 2: On deliberate click, `<PairingView>` mounts and initiates the
 *     pairing seeded with `authenticatorHints`, so only the same wallet can
 *     complete it. We intentionally do NOT pre-reset the singleton on click:
 *     the client's own `forceConnect` already handles an in-flight pairing
 *     safely — it closes the live socket and reconnects with OUR hints from
 *     inside the close-hook (after the connection ref is nulled). A manual
 *     pre-reset would instead null the ref then immediately reconnect, leaving
 *     the stale close event to stomp the fresh connection.
 *
 * On success: `applyDistantSession` has already written the fresh session
 * before `onSuccess` fires; we then invalidate queries and close.
 *
 * On dismiss:
 *   - `softReset()` (if pairing was started) closes the orphaned initiate-WS
 *     so a late phone scan cannot write a session after logout. Note: `reset()`
 *     would also `clearSession()`, destroying a re-pair completed in ANOTHER
 *     tab before the freshness check runs — `softReset()` preserves cross-tab
 *     session state and is the correct call.
 *   - Freshness re-check: if the token is still dead, log out. This is not
 *     "airtight" — if the user pressed dismiss before the `authenticated` WS
 *     message arrived, their explicit cancel is treated as a cancel (correct
 *     semantics). No realistic spurious logout occurs because `settledRef`
 *     ensures only the first of {success, dismiss} runs to completion.
 *
 * Known limitation: if the hinted passkey was deleted server-side, every join
 * attempt returns FORBIDDEN and `PairingView` shows the generic error+Retry
 * state indefinitely. The only escape is dismiss→logout. This is documented
 * rather than handled this cycle — the generic copy does not explain the cause,
 * but dismiss→logout is a working recovery path.
 */
export function DistantReauthModal({
    authenticatorHints,
    onClose,
}: DistantReauthModalProps) {
    const { t } = useTranslation();
    const { logout } = useLogout();
    const queryClient = useQueryClient();

    const [started, setStarted] = useState(false);
    const settledRef = useRef(false);

    const handleSuccess = useCallback(async () => {
        if (settledRef.current) return;
        settledRef.current = true;
        // applyDistantSession has already written the fresh session; refetch
        // everything loaded under the dead token.
        await queryClient.invalidateQueries();
        onClose();
    }, [queryClient, onClose]);

    const handleDismiss = useCallback(async () => {
        if (settledRef.current) return;
        settledRef.current = true;
        onClose();
        if (started) {
            // Close the orphaned initiate-WS so a late phone scan can't write
            // a session over whatever state the user lands in after logout.
            // softReset (not reset) preserves sessionStore so the freshness
            // check below sees any re-pair completed in another tab.
            getOriginPairingClient().softReset();
        }
        // Re-check freshness: a re-pair in another tab (or this modal before
        // dismiss) may have restored a valid session. Only logout if still dead.
        const token = getSafeSession()?.token;
        if (!token || isExpired(token, 60_000)) {
            await logout();
        }
    }, [started, onClose, logout]);

    const title = t("wallet.distantReauth.title", "Reconnect your wallet");
    const description = t(
        "wallet.distantReauth.description",
        "Your paired session expired. Scan with your phone to reconnect the same wallet."
    );

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) void handleDismiss();
            }}
            title={title}
            description={description}
        >
            <Box
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    padding: "1rem",
                }}
            >
                {started ? (
                    <PairingView
                        title={title}
                        description={t(
                            "wallet.distantReauth.pairing",
                            "Scan with the phone holding your passkey to reconnect the same wallet."
                        )}
                        authenticatorHints={authenticatorHints}
                        onSuccess={handleSuccess}
                    />
                ) : (
                    <ContentBlock
                        icon={<QrCodeIcon />}
                        titleAs="h2"
                        title={title}
                        description={description}
                        footer={
                            <Button onClick={() => setStarted(true)}>
                                {t("wallet.distantReauth.action", "Reconnect")}
                            </Button>
                        }
                    />
                )}
            </Box>
        </ResponsiveModal>
    );
}
