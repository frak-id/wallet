import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { useLogin } from "@frak-labs/wallet-shared";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import { useTranslation } from "react-i18next";
import { useLastAuthenticatorHint } from "@/module/authentication/hook/useLastAuthenticatorHint";
import { useLogout } from "@/module/authentication/hook/useLogout";
import { ContentBlock } from "@/module/common/component/ContentBlock";

type ReauthModalProps = {
    reason: "grace" | "dead";
    onAuthSuccess?: () => void;
    onClose: () => void;
};

/**
 * Quick biometric re-authentication modal.
 *
 * Shown when:
 * - `reason: "grace"` — the wallet token still works server-side but is nearing
 *   expiry and the user clicked the passive banner, or
 * - `reason: "dead"` — the token is confirmed unusable: its client `exp` has
 *   passed, OR the server returned a 401 (incl. JWT-secret rotation / revocation
 *   where `exp` is still in the future, so a clock check would wrongly say it's
 *   alive).
 *
 * On success: `useLogin` writes a fresh 30-day wallet token + 1-day SDK token,
 * and every TanStack query is invalidated so data fetched under the dead token
 * is refetched with the new one.
 *
 * Dismiss policy:
 *   - `reason: "grace"` → the session still works, so the modal is dismissable
 *     (backdrop / ESC) and dismissing just closes it.
 *   - `reason: "dead"`  → the session is unusable, so the modal is LOCKED (a
 *     backdrop / ESC tap does nothing). The user makes an explicit choice:
 *     "Verify identity" (re-auth) or "Log out". This avoids stranding the user
 *     in a zombie session AND avoids a destructive silent logout from an
 *     accidental dismiss gesture.
 */
export function ReauthModal({
    reason,
    onAuthSuccess,
    onClose,
}: ReauthModalProps) {
    const { t } = useTranslation();
    const { logout } = useLogout();
    const hint = useLastAuthenticatorHint();
    const isDead = reason === "dead";

    const { login, isLoading } = useLogin({
        // The 4th callback arg is TanStack's MutationFunctionContext, which
        // carries the live QueryClient — no `useQueryClient()` needed.
        onSuccess: async (_session, _vars, _ctx, { client }) => {
            // The previous token is dead/stale: refetch everything that was
            // loaded under it so the UI reflects the freshly minted session.
            await client.invalidateQueries();
            onAuthSuccess?.();
            onClose();
        },
    });

    // Re-authenticate against the credential already bound to this session.
    // Priority order:
    //  1. Live session authenticatorId — most precise, scopes WebAuthn to the
    //     exact passkey in use right now.
    //  2. `useLastAuthenticatorHint` — survives session expiry; covers the
    //     common case where the token is dead and getSafeSession() returns
    //     null but we still know which passkey the user last registered with.
    //  3. Unscoped fallback — lets the OS/browser present its full passkey
    //     picker.
    const handleReauth = () => {
        const authenticatorId = getSafeSession()?.authenticatorId;
        if (authenticatorId) {
            login({ allowedCredentialIds: [authenticatorId] });
        } else if (hint) {
            login({ lastAuthentication: hint });
        } else {
            login(undefined);
        }
    };

    // Explicit, deliberate logout (the "dead" modal's secondary action).
    const handleLogout = async () => {
        onClose();
        await logout();
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (open) return;
                // Grace: dismissable — a backdrop/ESC tap just closes it.
                // Dead: locked — ignore close so the user must pick Verify
                // identity or Log out (no destructive silent logout).
                if (!isDead) onClose();
            }}
            title={t("wallet.reauth.title", "Session expiring")}
            description={t(
                "wallet.reauth.description",
                "Please verify your identity to continue."
            )}
        >
            <Box
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    padding: "1rem",
                }}
            >
                <ContentBlock
                    icon={<FaceIdIcon />}
                    titleAs="h2"
                    title={t("wallet.reauth.title", "Session expiring")}
                    description={t(
                        "wallet.reauth.description",
                        "Please verify your identity to continue."
                    )}
                    footer={
                        <>
                            <Button onClick={handleReauth} loading={isLoading}>
                                {t("wallet.reauth.action", "Verify identity")}
                            </Button>
                            {isDead && (
                                <Button
                                    variant="ghost"
                                    onClick={handleLogout}
                                    disabled={isLoading}
                                >
                                    {t("wallet.reauth.logout", "Log out")}
                                </Button>
                            )}
                        </>
                    }
                />
            </Box>
        </ResponsiveModal>
    );
}
