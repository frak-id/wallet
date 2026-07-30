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
     * Backend-enforced credential allow-list from the dead session's
     * `authenticatorId`. Backend rejects any joiner not in this set, forcing
     * re-pair to the SAME wallet.
     *
     * Pass a stable reference — a new array literal here re-fires the
     * initiate effect every render.
     */
    authenticatorHints: string[];
    onClose: () => void;
};

/**
 * Two-phase re-pair prompt for a PAIRED session whose wallet token is
 * server-confirmed dead — the passkey lives on another device, so no local
 * biometric re-auth is possible.
 *
 * It first shows the prompt without touching the shared
 * `OriginPairingClient` singleton, so an in-flight user-driven pairing
 * isn't torn down. On click, `<PairingView>` mounts seeded with
 * `authenticatorHints`. We don't
 * pre-reset the singleton: `forceConnect` closes the live socket and
 * reconnects with our hints from inside the close-hook, after the ref is
 * nulled — a manual pre-reset would let the stale close event stomp the
 * fresh connection.
 *
 * On success, `applyDistantSession` already wrote the fresh session before
 * `onSuccess` fires; we invalidate queries and close.
 *
 * On dismiss: `softReset()` (not `reset()`) closes the orphaned initiate-WS
 * without clearing session, so a re-pair completed in another tab survives.
 * Then logout, unless the token changed since open (re-pair happened
 * elsewhere) — keyed on the token changing rather than `exp`, since a
 * server-side key rotation leaves the dead token's `exp` in the future.
 * `settledRef` ensures only the first of {success, dismiss} runs.
 *
 * Known limitation: if the hinted passkey was deleted server-side, every
 * join attempt is FORBIDDEN and `PairingView` shows a generic retry error
 * indefinitely; the only escape is dismiss→logout.
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
        // Fresh session already written; refetch everything loaded under the dead token.
        await queryClient.invalidateQueries();
        onClose();
    }, [queryClient, onClose]);

    // Modal is locked (see onOpenChange); this and re-pair are the only exits.
    const handleLogout = useCallback(async () => {
        if (settledRef.current) return;
        settledRef.current = true;
        onClose();
        if (started) {
            // Close orphaned initiate-WS so a late phone scan can't write a
            // session post-logout; a throw here must not skip the logout below.
            try {
                getOriginPairingClient().softReset();
            } catch {}
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
                // Locked: a dead paired session can't be dismissed into a working state.
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
