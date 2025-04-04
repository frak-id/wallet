import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { TargetPairingClient } from "@/module/pairing/clients/target";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function PairingInfo({ client }: { client: TargetPairingClient }) {
    const { t } = useTranslation();

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                {t("wallet.pairing.info.title")}
            </Title>
            <ul className={styles.pairing__list}>
                <li>
                    {t("wallet.pairing.info.device")}
                    {client.state.partnerDevice}
                </li>
            </ul>
        </Panel>
    );
}
