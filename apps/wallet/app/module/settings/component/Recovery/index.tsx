import { selectWebauthnSession, sessionStore } from "@frak-labs/wallet-shared";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { CurrentRecoverySetupStatus } from "@/module/recovery-setup/component/CurrentSetupStatus";

/**
 * Component for the settings with the recovery link
 * @constructor
 */
export function RecoveryLink() {
    const { t } = useTranslation();
    const webauthnSession = sessionStore(selectWebauthnSession);

    if (!webauthnSession) {
        return null;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<Shield size={32} />}>
                {t("wallet.recoverySetup.title")}
            </Title>
            <CurrentRecoverySetupStatus />
            <Link to={"/settings/recovery"} viewTransition>
                {t("wallet.recoverySetup.setupNew")}
            </Link>
        </Panel>
    );
}
