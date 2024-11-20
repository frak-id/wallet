import { Logout } from "@/module/authentication/component/Logout";
import { sessionAtom } from "@/module/common/atoms/session";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { WalletAddress } from "@module/component/HashDisplay";
import { useAtomValue } from "jotai";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { toHex } from "viem";
import { useAccount } from "wagmi";
import styles from "./settings.module.css";

export default function Settings() {
    return (
        <Grid footer={<Logout />}>
            <BiometryInfo />
            <RecoveryLink />
            <RemoveAllNotification />
        </Grid>
    );
}

function BiometryInfo() {
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
