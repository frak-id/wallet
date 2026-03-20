import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { useMoneriumIban } from "@/module/monerium/hooks/useMoneriumIban";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import styles from "./MoneriumConnect.module.css";

export function MoneriumConnect() {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { connect, disconnect, isConnecting, isConnected } =
        useMoneriumAuth();
    const { profileState } = useMoneriumStatus();
    const { iban, isLinkedToWallet } = useMoneriumIban();

    const handleConnect = () => {
        if (address) {
            connect(address);
        }
    };

    const needsOnboarding =
        profileState === "created" || profileState === "pending";

    const statusText = (() => {
        if (!isConnected) return null;
        if (profileState === "created") return t("monerium.status.created");
        if (profileState === "pending") return t("monerium.status.pending");
        if (profileState === "approved") return t("monerium.status.approved");
        if (profileState === "rejected" || profileState === "blocked")
            return t("monerium.status.rejected");
        return t("monerium.status.settingUp");
    })();

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

            {isConnecting ? (
                <Button disabled leftIcon={<Spinner />} size={"small"}>
                    {t("monerium.connecting")}
                </Button>
            ) : isConnected ? (
                <div className={styles.moneriumConnect__actions}>
                    {needsOnboarding && (
                        <Button
                            size={"small"}
                            onClick={handleConnect}
                            disabled={!address}
                        >
                            {t("monerium.completeSetup")}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size={"small"}
                        onClick={disconnect}
                    >
                        {t("monerium.disconnect")}
                    </Button>
                </div>
            ) : (
                <Button
                    size={"small"}
                    onClick={handleConnect}
                    disabled={!address}
                >
                    {t("monerium.connect")}
                </Button>
            )}
        </Panel>
    );
}
