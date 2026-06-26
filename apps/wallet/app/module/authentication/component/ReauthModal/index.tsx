import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { useLogin } from "@frak-labs/wallet-shared";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import { isExpired } from "@frak-labs/wallet-shared/common/utils/tokenExpiry";
import { useTranslation } from "react-i18next";
import { useLastAuthenticatorHint } from "@/module/authentication/hook/useLastAuthenticatorHint";
import { useLogout } from "@/module/authentication/hook/useLogout";
import { ContentBlock } from "@/module/common/component/ContentBlock";

type ReauthModalProps = {
    expired: boolean;
    onAuthSuccess?: () => void;
    onClose: () => void;
};

/**
 * Quick biometric re-authentication modal.
 *
 * Shown when:
 * - The wallet token is approaching expiry (grace window) and the user clicked
 *   the passive banner, or
 * - The server returned a 401 confirming the token is dead.
 *
 * On success: `useLogin` writes a fresh 30-day wallet token + 1-day SDK token,
 * and every TanStack query is invalidated so data fetched under the dead token
 * is refetched with the new one.
 * On dismiss:
 *   - `expired = true` → call `useLogout()` (token past its expiry date).
 *   - `expired = false` → just close (pre-expiry server 401; keep stale state
 *     and let the user continue until the next hard failure).
 */
export function ReauthModal({
    expired,
    onAuthSuccess,
    onClose,
}: ReauthModalProps) {
    const { t } = useTranslation();
    const { logout } = useLogout();
    const hint = useLastAuthenticatorHint();

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

    const handleDismiss = async () => {
        onClose();
        if (!expired) return;
        // Re-check freshness at dismiss time: another tab (or a background
        // refresh) may have restored a valid session since this modal opened.
        // Only logout if the token is STILL expired — never clobber a session
        // that was just renewed elsewhere.
        const token = getSafeSession()?.token;
        if (!token || isExpired(token, 60_000)) {
            await logout();
        }
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) void handleDismiss();
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
                        <Button onClick={handleReauth} loading={isLoading}>
                            {t("wallet.reauth.action", "Verify identity")}
                        </Button>
                    }
                />
            </Box>
        </ResponsiveModal>
    );
}
