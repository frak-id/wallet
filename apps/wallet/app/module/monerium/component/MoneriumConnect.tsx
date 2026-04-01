import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { TFunction } from "i18next";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useMoneriumAddresses } from "@/module/monerium/hooks/useMoneriumAddresses";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { useMoneriumIban } from "@/module/monerium/hooks/useMoneriumIban";
import { useMoneriumLinkWallet } from "@/module/monerium/hooks/useMoneriumLinkWallet";
import { useMoneriumProfile } from "@/module/monerium/hooks/useMoneriumProfile";
import styles from "./MoneriumConnect.module.css";

function getStatusText(
    profileState: string | null,
    t: TFunction
): string | null {
    switch (profileState) {
        case "created":
            return t("monerium.status.created");
        case "pending":
            return t("monerium.status.pending");
        case "approved":
            return t("monerium.status.approved");
        case "rejected":
        case "blocked":
            return t("monerium.status.rejected");
        default:
            return t("monerium.status.settingUp");
    }
}

export function MoneriumConnect() {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { connect, disconnect, isConnecting, isConnected } =
        useMoneriumAuth();
    const { profileState } = useMoneriumProfile();
    const { iban, isLinkedToWallet } = useMoneriumIban();
    const { isWalletLinked } = useMoneriumAddresses();
    const { linkWallet, isPending: isLinkingWallet } = useMoneriumLinkWallet();

    const handleConnect = () => {
        if (address) {
            connect(address);
        }
    };

    const statusText = isConnected ? getStatusText(profileState, t) : null;

    return (
        <Panel size={"small"}>
            <Title icon={<Building2 size={32} />}>
                {t("monerium.account")}
            </Title>

            {statusText && (
                <p className={styles.moneriumConnect__status}>{statusText}</p>
            )}

            {isConnected && iban && (
                <p className={styles.moneriumConnect__iban}>{iban}</p>
            )}

            {isConnected && iban && !isLinkedToWallet && (
                <p className={styles.moneriumConnect__warning}>
                    {t("monerium.badge.notLinked")}
                </p>
            )}

            <MoneriumActions
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
        </Panel>
    );
}

function MoneriumActions({
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
            <Button disabled icon={<Spinner size={"s"} />} size={"small"}>
                {t("monerium.connecting")}
            </Button>
        );
    }

    if (!isConnected) {
        return (
            <Button size={"small"} onClick={onConnect} disabled={!address}>
                {t("monerium.connect")}
            </Button>
        );
    }

    const needsOnboarding =
        profileState === "created" || profileState === "pending";

    return (
        <div className={styles.moneriumConnect__actions}>
            {needsOnboarding && (
                <Button size={"small"} onClick={onConnect} disabled={!address}>
                    {t("monerium.completeSetup")}
                </Button>
            )}
            {!isWalletLinked && (
                <Button
                    size={"small"}
                    onClick={onLinkWallet}
                    disabled={isLinkingWallet}
                >
                    {t("monerium.linkWallet")}
                </Button>
            )}
            <Button variant="ghost" size={"small"} onClick={onDisconnect}>
                {t("monerium.disconnect")}
            </Button>
        </div>
    );
}
