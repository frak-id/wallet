import { Button } from "@frak-labs/design-system/components/Button";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useNavigate } from "@tanstack/react-router";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useAuthStore } from "@/stores/authStore";

// SIWE session lifetime: 1 week.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Unchanged SIWE flow (§4.6): `POST /auth/login` mints an already
 * 2FA-verified session — the passkey ceremony counts as inherent MFA.
 */
export function WalletPanel() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [, startTransition] = useTransition();

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                const response = await authenticatedBackendApi.auth.login.post({
                    message: data.message,
                    signature: data.signature,
                });

                if (response.error) {
                    console.error("Login failed:", response.error);
                    return;
                }

                useAuthStore.getState().setAuth({
                    token: response.data.token,
                    wallet: response.data.wallet,
                    authMethod: "siwe",
                    expiresAt: response.data.expiresAt,
                });

                startTransition(() => {
                    navigate({ to: "/dashboard" });
                });
            },
        },
    });

    const handleConnect = () =>
        authenticate({
            siwe: {
                expirationTimeTimestamp: Date.now() + SESSION_DURATION_MS,
            },
        });

    return (
        <Button
            variant="primary"
            size="large"
            width="auto"
            loading={isPending}
            onClick={handleConnect}
        >
            {t("auth.login.connect")}
        </Button>
    );
}
