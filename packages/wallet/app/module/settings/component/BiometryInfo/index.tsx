import { sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { WalletAddress } from "@module/component/HashDisplay";
import { useAtomValue } from "jotai";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { toHex } from "viem";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function BiometryInfo() {
    const isHydrated = useHydrated();
    const { t } = useTranslation();
    const { address } = useAccount();
    const wallet = useAtomValue(sessionAtom);

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                {t("wallet.biometryInfos")}
            </Title>
            <ul className={styles.settings__list}>
                <li>
                    {t("common.authenticator")}{" "}
                    {isHydrated && (
                        <WalletAddress
                            wallet={toHex(wallet?.authenticatorId ?? "0")}
                            copiedText={t("common.copied")}
                        />
                    )}
                </li>

                <li>
                    {t("common.wallet")}{" "}
                    {isHydrated && (
                        <WalletAddress
                            wallet={address ?? "0x"}
                            copiedText={t("common.copied")}
                        />
                    )}
                </li>
            </ul>
        </Panel>
    );
}
