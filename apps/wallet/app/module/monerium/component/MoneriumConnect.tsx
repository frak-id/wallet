import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { useMoneriumAddresses } from "@/module/monerium/hooks/useMoneriumAddresses";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { useMoneriumLinkWallet } from "@/module/monerium/hooks/useMoneriumLinkWallet";
import { useMoneriumProfile } from "@/module/monerium/hooks/useMoneriumProfile";
import {
    SettingsCard,
    SettingsRow,
    settingsCardStyles,
} from "@/module/settings/component/SettingsCard";

export function MoneriumConnect() {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { connect, disconnect, isConnecting, isConnected } =
        useMoneriumAuth();
    const { profileState } = useMoneriumProfile();
    const { isWalletLinked } = useMoneriumAddresses();
    const { linkWallet, isPending: isLinkingWallet } = useMoneriumLinkWallet();

    const handleConnect = () => {
        if (address) {
            connect(address);
        }
    };

    return (
        <SettingsCard>
            <SettingsRow
                icon={PersonIcon}
                label={t("monerium.account")}
                action={
                    <MoneriumAction
                        isConnecting={isConnecting}
                        isConnected={isConnected}
                        profileState={profileState}
                        address={address}
                        isWalletLinked={isWalletLinked}
                        isLinkingWallet={isLinkingWallet}
                        onConnect={handleConnect}
                        onDisconnect={disconnect}
                        onLinkWallet={linkWallet}
                    />
                }
            />
        </SettingsCard>
    );
}

function MoneriumAction({
    isConnecting,
    isConnected,
    profileState,
    address,
    isWalletLinked,
    isLinkingWallet,
    onConnect,
    onDisconnect,
    onLinkWallet,
}: {
    isConnecting: boolean;
    isConnected: boolean;
    profileState: string | null;
    address: string | undefined;
    isWalletLinked: boolean | undefined;
    isLinkingWallet: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    onLinkWallet: () => void;
}) {
    const { t } = useTranslation();

    if (isConnecting) {
        return (
            <Box
                as="span"
                display="flex"
                alignItems="center"
                gap="xxs"
                className={settingsCardStyles.actionButton}
            >
                <Spinner size="s" />
                <Text
                    as="span"
                    variant="bodySmall"
                    color="action"
                    weight="medium"
                >
                    {t("monerium.connecting")}
                </Text>
            </Box>
        );
    }

    if (!isConnected) {
        return (
            <ActionButton onClick={onConnect} disabled={!address}>
                {t("monerium.connect")}
            </ActionButton>
        );
    }

    const needsOnboarding =
        profileState === "created" || profileState === "pending";

    if (needsOnboarding) {
        return (
            <ActionButton onClick={onConnect} disabled={!address}>
                {t("monerium.completeSetup")}
            </ActionButton>
        );
    }

    if (!isWalletLinked) {
        return (
            <ActionButton onClick={onLinkWallet} disabled={isLinkingWallet}>
                {t("monerium.linkWallet")}
            </ActionButton>
        );
    }

    return (
        <ActionButton onClick={onDisconnect}>
            {t("monerium.disconnect")}
        </ActionButton>
    );
}

function ActionButton({
    children,
    onClick,
    disabled,
}: {
    children: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            className={settingsCardStyles.actionButton}
            onClick={onClick}
            disabled={disabled}
        >
            <Text
                as="span"
                variant="bodySmall"
                color={disabled ? "disabled" : "action"}
                weight="medium"
            >
                {children}
            </Text>
        </button>
    );
}
