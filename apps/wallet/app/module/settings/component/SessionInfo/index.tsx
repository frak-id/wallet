import { Box } from "@frak-labs/ui/component/Box";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import {
    selectEcdsaSession,
    selectWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { Fingerprint, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { toHex } from "viem";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { isCryptoMode } from "@/module/common/utils/walletMode";

export function SessionInfo() {
    const isHydrated = useHydrated();
    const { t } = useTranslation();
    const { address } = useAccount();
    const webauthnWallet = sessionStore(selectWebauthnSession);
    const ecdsaWallet = sessionStore(selectEcdsaSession);

    const accountLabel = isCryptoMode
        ? t("common.wallet")
        : t("common.accountId", "Account ID:");

    if (webauthnWallet) {
        return (
            <Panel size={"small"}>
                <Title icon={<Fingerprint size={32} />}>
                    {t("wallet.settings.biometryInfo")}
                </Title>
                <Box as={"ul"} direction={"column"} gap={"ms"} padding={"none"}>
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
                        {accountLabel}{" "}
                        {isHydrated && (
                            <WalletAddress
                                wallet={address ?? "0x"}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>
                </Box>
            </Panel>
        );
    }

    if (ecdsaWallet) {
        return (
            <Panel size={"small"}>
                <Title icon={<KeyRound size={32} />}>
                    {t("wallet.settings.ecdsaInfo")}
                </Title>
                <Box as={"ul"} direction={"column"} gap={"ms"} padding={"none"}>
                    <li>
                        {t("wallet.settings.ecdsaWallet")}{" "}
                        {isHydrated && (
                            <WalletAddress
                                wallet={toHex(ecdsaWallet.publicKey)}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>

                    <li>
                        {accountLabel}{" "}
                        {isHydrated && (
                            <WalletAddress
                                wallet={address ?? "0x"}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>
                </Box>
            </Panel>
        );
    }

    return null;
}
