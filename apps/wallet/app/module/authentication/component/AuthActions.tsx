import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    isWebAuthNSupported,
    trackEvent,
    useLogin,
} from "@frak-labs/wallet-shared";
import { Trans, useTranslation } from "react-i18next";
import { type Address, slice } from "viem";
import { useLastAuthenticatorHint } from "@/module/authentication/hook/useLastAuthenticatorHint";

type AuthActionsProps = {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    isLoading?: boolean;
    className?: string;
};

/**
 * Login actions rendered on the `/login` page.
 *
 * Layout:
 *  - When a recovery hint exists (Zustand store, or uninstall-resilient
 *    cloud KV hint): primary "Use my account 0x…" + secondary "Connect
 *    another account" (`wallet.login.anotherAccount`).
 *  - When no hint: primary biometric button labeled `wallet.login.button`
 *    ("Use biometrics") — same text as the legacy login flow.
 *  - The "Create a new wallet" action lives on the page header (see the
 *    `<Back>` button on `/login`) which routes to `/register?new=1`.
 */
export function AuthActions({
    onSuccess,
    onError,
    isLoading,
    className,
}: AuthActionsProps) {
    const { t } = useTranslation();
    const hint = useLastAuthenticatorHint();
    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });
    const loading = isLoading || isLoginLoading;

    if (!isWebAuthNSupported) {
        return (
            <Text as="p" className={className}>
                {t("wallet.openLogin.webauthnNotSupported")}
            </Text>
        );
    }

    const handleUseExisting = () => {
        if (!hint) return;
        onError(null);
        trackEvent("auth_login_method_selected", {
            method: "passkey",
            origin: "existing",
        });
        login({ lastAuthentication: hint });
    };

    const handleAnother = () => {
        onError(null);
        trackEvent("auth_login_method_selected", {
            method: "passkey",
            origin: "another",
        });
        login({});
    };

    return (
        <>
            {hint && (
                <Box>
                    <Button
                        variant="primary"
                        icon={<FaceIdIcon width={24} height={24} />}
                        loading={loading}
                        onClick={handleUseExisting}
                        className={className}
                    >
                        <Trans
                            i18nKey="wallet.login.useMyAccount"
                        />
                    </Button>
                </Box>
            )}
            <Box>
                <Button
                    variant={hint ? "secondary" : "primary"}
                    icon={
                        hint ? undefined : <FaceIdIcon width={24} height={24} />
                    }
                    loading={loading}
                    onClick={handleAnother}
                    className={className}
                >
                    <Trans
                        i18nKey={
                            hint
                                ? "wallet.login.anotherAccount"
                                : "wallet.login.button"
                        }
                    />
                </Button>
            </Box>
        </>
    );
}
