"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { CurrentRecoverySetupStatus } from "@/module/recovery-setup/component/CurrentSetupStatus";
import { Shield } from "lucide-react";
import Link from "next/link";
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
            <Link href={"/settings/recovery"}>
                {t("wallet.recoverySetup.setupNew")}
            </Link>
        </Panel>
    );
}
