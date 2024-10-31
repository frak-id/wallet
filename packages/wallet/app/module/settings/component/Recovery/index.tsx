import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { CurrentRecoverySetupStatus } from "@/module/recovery-setup/component/CurrentSetupStatus";
import { Link } from "@remix-run/react";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Component for the settings with the recovery link
 * @constructor
 */
export function RecoveryLink() {
    const { t } = useTranslation();
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
