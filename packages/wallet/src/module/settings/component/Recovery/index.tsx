"use client";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { CurrentRecoverySetupStatus } from "@/module/recovery-setup/component/CurrentSetupStatus";
import { Shield } from "lucide-react";
import Link from "next/link";

/**
 * Component for the settings with the recovery link
 * @constructor
 */
export function RecoveryLink() {
    return (
        <Panel size={"small"}>
            <Title icon={<Shield size={32} />}>Recovery setup</Title>
            <CurrentRecoverySetupStatus />
            <Link href={"/settings/recovery"}>Setup new recovery</Link>
        </Panel>
    );
}
