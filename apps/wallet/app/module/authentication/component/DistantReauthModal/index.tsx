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
     * Backend-enforced credential allow-list forcing re-pair to the SAME
     * wallet. Pass a stable reference — a new array literal re-fires the
     * initiate effect every render.
     */
    authenticatorHints: string[];
    onClose: () => void;
};

/**
 * Two-phase re-pair prompt for a PAIRED session whose token is dead. Phase 1
 * must not touch the `OriginPairingClient` singleton, or an in-flight
 * user-driven pairing is torn down; dismissal uses `softReset()` (not
 * `reset()`) so a re-pair completed in another tab survives.
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
