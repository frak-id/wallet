import {
    privySessionAtom,
    webauthnSessionAtom,
} from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { WalletAddress } from "@module/component/HashDisplay";
import { useAtomValue } from "jotai";
import { Fingerprint, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { toHex } from "viem";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function SessionInfo() {
    const isHydrated = useHydrated();
    const { t } = useTranslation();
    const { address } = useAccount();
    const webauthnWallet = useAtomValue(webauthnSessionAtom);
    const privyWallet = useAtomValue(privySessionAtom);

    if (webauthnWallet) {
        return (
            <Panel size={"small"}>
                <Title icon={<Fingerprint size={32} />}>
                    {t("wallet.settings.biometryInfo")}
                </Title>
                <ul className={styles.settings__list}>
                    <li>
                        {t("common.authenticator")}{" "}
                        {isHydrated && (
                            <WalletAddress
                                wallet={toHex(webauthnWallet.authenticatorId)}
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

    if (privyWallet) {
        return (
            <Panel size={"small"}>
                <Title icon={<KeyRound size={32} />}>
                    {t("wallet.settings.privyInfo")}
                </Title>
                <ul className={styles.settings__list}>
                    <li>
                        {t("wallet.settings.privyWallet")}{" "}
                        {isHydrated && (
                            <WalletAddress
                                wallet={toHex(privyWallet.publicKey)}
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

    return null;
}
