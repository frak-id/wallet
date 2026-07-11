import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useNavigate } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { safeRedirectTarget } from "@/module/auth/utils/safeRedirect";
import { useAuthStore } from "@/stores/authStore";

// SIWE session lifetime: 1 week.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Unchanged SIWE flow (§4.6): `POST /auth/login` mints an already
 * 2FA-verified session — the passkey ceremony counts as inherent MFA.
 */
export function WalletPanel({ redirect }: { redirect?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                setError(null);
                const response = await authenticatedBackendApi.auth.login.post({
                    message: data.message,
                    signature: data.signature,
                });

                if (response.error) {
                    // Surface the failure like `EmailPanel` does, instead of
                    // swallowing it into the console (§2.6).
                    setError(
                        extractAuthErrorMessage(
                            response.error,
                            t("auth.login.walletError")
                        )
                    );
                    return;
                }

                useAuthStore.getState().setAuth({
                    token: response.data.token,
                    wallet: response.data.wallet,
                    authMethod: "siwe",
                    expiresAt: response.data.expiresAt,
                });

                startTransition(() => {
                    navigate({ to: safeRedirectTarget(redirect) });
                });
            },
            onError: (err) => {
                setError(
                    extractAuthErrorMessage(err, t("auth.login.walletError"))
                );
            },
        },
    });

    const handleConnect = () => {
        setError(null);
        authenticate({
            siwe: {
                expirationTimeTimestamp: Date.now() + SESSION_DURATION_MS,
            },
        });
    };

    return (
        <Stack space="s">
            <Button
                variant="primary"
                size="large"
                width="full"
                loading={isPending}
                onClick={handleConnect}
            >
                {t("auth.login.connect")}
            </Button>
            {error && <Notice tone="error">{error}</Notice>}
        </Stack>
    );
}
