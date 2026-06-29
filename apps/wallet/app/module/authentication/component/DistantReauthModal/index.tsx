import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { QrCodeIcon } from "@frak-labs/design-system/icons";
import { getOriginPairingClient, PairingView } from "@frak-labs/wallet-shared";
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
 *   - Log out (the paired token is server-confirmed dead with no local
 *     recovery), UNLESS the wallet token changed since open — a re-pair that
 *     completed in another tab. This is keyed on the token CHANGING, not on
 *     client `exp`, because a server-side key rotation leaves the dead token's
 *     `exp` in the future. `settledRef` ensures only the first of
 *     {success, dismiss} runs, so a re-pair here can't also trigger logout.
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

    // Explicit, deliberate logout (the modal's secondary action). The modal is
    // locked (see onOpenChange) so this is the ONLY exit besides a successful
    // re-pair — no destructive silent logout from an accidental dismiss.
    const handleLogout = useCallback(async () => {
        if (settledRef.current) return;
        settledRef.current = true;
        onClose();
        if (started) {
            // Close the orphaned initiate-WS so a late phone scan can't write
            // a session after the user has logged out.
            getOriginPairingClient().softReset();
        }
        await logout();
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
                // Locked: a dead paired session can't be dismissed into a
                // working state, so ignore backdrop/ESC. The only exits are a
                // successful re-pair or the explicit Log out button.
                if (open) return;
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
                    <>
                        <PairingView
                            title={title}
                            description={t(
                                "wallet.distantReauth.pairing",
                                "Scan with the phone holding your passkey to reconnect the same wallet."
                            )}
                            authenticatorHints={authenticatorHints}
                            onSuccess={handleSuccess}
                        />
                        <Button variant="ghost" onClick={handleLogout}>
                            {t("wallet.distantReauth.logout", "Log out")}
                        </Button>
                    </>
                ) : (
                    <ContentBlock
                        icon={<QrCodeIcon />}
                        titleAs="h2"
                        title={title}
                        description={description}
                        footer={
                            <>
                                <Button onClick={() => setStarted(true)}>
                                    {t(
                                        "wallet.distantReauth.action",
                                        "Reconnect"
                                    )}
                                </Button>
                                <Button variant="ghost" onClick={handleLogout}>
                                    {t(
                                        "wallet.distantReauth.logout",
                                        "Log out"
                                    )}
                                </Button>
                            </>
                        }
                    />
                )}
            </Box>
        </ResponsiveModal>
    );
}
