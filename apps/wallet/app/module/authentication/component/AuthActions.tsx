import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    isWebAuthNSupported,
    trackEvent,
    useLogin,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { type Address, slice } from "viem";
import { useLastAuthenticatorHint } from "@/module/authentication/hook/useLastAuthenticatorHint";

type AuthActionsProps = {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    isLoading?: boolean;
    className?: string;
};

function shortenAddress(address: Address): string {
    const start = slice(address, 0, 3); // "0x" + 2 hex chars
    const end = slice(address, -4).replace("0x", "");
    return `${start}...${end}`;
}

/**
 * Login actions rendered on the `/login` page.
 *
 * Layout:
 *  - When a recovery hint exists (Zustand store, or uninstall-resilient
 *    cloud KV hint): primary "Use my account 0x…" + secondary "Connect
 *    another account" (`wallet.login.anotherAccount`).
 *  - When no hint: primary biometric button labeled `wallet.login.button`
 *    ("Use biometrics") — same text as the legacy login flow.
 *  - Always: secondary "Create a new wallet" that navigates to
 *    `/register?new=1` (registration happens on the register page, not
 *    inline here).
 */
export function AuthActions({
    onSuccess,
    onError,
    isLoading,
    className,
}: AuthActionsProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
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

    const handleCreateNew = () => {
        trackEvent("auth_login_method_selected", {
            method: "register_redirect",
        });
        navigate({ to: "/register", search: { new: true } });
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
                            values={{ address: shortenAddress(hint.wallet) }}
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
            <Box>
                <Button variant="secondary" onClick={handleCreateNew}>
                    <Trans i18nKey="authent.sso.btn.existing.create" />
                </Button>
            </Box>
        </>
    );
}
