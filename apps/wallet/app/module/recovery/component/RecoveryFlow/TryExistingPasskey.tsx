import { Button } from "@frak-labs/design-system/components/Button";
import { useLogin } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Optional shortcut for users who still hold a working passkey: a discoverable
 * login (no credential hint) that drops them straight into their wallet,
 * skipping recovery entirely. Failures are swallowed on purpose — "no passkey
 * here" or a cancelled prompt simply means the user keeps going with recovery.
 */
export function TryExistingPasskey() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login, isLoading } = useLogin();

    const handleSignIn = useCallback(async () => {
        try {
            await login();
            navigate({ to: "/wallet" });
        } catch {
            // No usable passkey on this device (or cancelled) — stay in the
            // recovery flow.
        }
    }, [login, navigate]);

    return (
        <Button
            type="button"
            variant="secondary"
            size="large"
            width="full"
            loading={isLoading}
            disabled={isLoading}
            onClick={handleSignIn}
        >
            {t("wallet.recoveryUsage.signIn.action")}
        </Button>
    );
}
