import { usePairingInfo } from "@frak-labs/wallet-shared";
import type { TargetPairingState } from "@frak-labs/wallet-shared/pairing/types";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { PairingStatus } from "@/module/pairing/component/PairingStatus";
import styles from "./index.module.css";

export function PairingInfo({
    state,
    id,
}: {
    state: TargetPairingState;
    id: string;
}) {
    const { t } = useTranslation();
    const { data: pairingInfo } = usePairingInfo({ id });

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                {t("wallet.pairing.info.title")}
            </Title>
            <ul className={styles.pairing__list}>
                <li>
                    {t("wallet.pairing.info.status")}{" "}
                    <PairingStatus status={state.status} />
                </li>
                {pairingInfo && (
                    <li>
                        {t("wallet.pairing.info.device")}{" "}
                        {pairingInfo?.originName ?? "..."}
                    </li>
                )}
            </ul>
        </Panel>
    );
}
