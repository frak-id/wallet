import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { TargetPairingState } from "@/module/pairing/types";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePairingInfo } from "../../hook/usePairingInfo";
import styles from "./index.module.css";

export function PairingInfo({
    state,
    id,
}: { state: TargetPairingState; id: string }) {
    const { t } = useTranslation();
    const { data: pairingInfo } = usePairingInfo({ id });

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                {t("wallet.pairing.info.title")}
            </Title>
            <ul className={styles.pairing__list}>
                <li>
                    {t("wallet.pairing.info.status")}
                    {state.status}
                </li>
            </ul>
            {pairingInfo && (
                <>
                    <ul className={styles.pairing__list}>
                        <li>
                            {t("wallet.pairing.info.device")}
                            {pairingInfo?.originName ?? "..."}
                        </li>
                    </ul>
                    <ul className={styles.pairing__list}>
                        <li>
                            {t("wallet.pairing.info.code")}
                            {pairingInfo?.pairingCode ?? "..."}
                        </li>
                    </ul>
                </>
            )}
        </Panel>
    );
}
