import { Box } from "@frak-labs/design-system/components/Box";
import {
    selectEcdsaSession,
    selectWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { Fingerprint, KeyRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { type Address, type Hex, slice, toHex } from "viem";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import * as styles from "./index.css";

function formatHash({
    hash,
    format = { start: 2, end: 3 },
}: {
    hash: Hex;
    format?: { start: number; end: number };
}) {
    if (!hash) return undefined;
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    const shortenHash = `${start}...${end}`;
    return hash ? shortenHash : undefined;
}

function WalletAddressDisplay({
    wallet,
    copiedText,
}: {
    wallet: Address;
    copiedText?: string;
}) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (copied) {
            const timeoutId = setTimeout(() => {
                setCopied(false);
            }, 2000);
            return () => clearTimeout(timeoutId);
        }
    }, [copied]);

    const hashedAddress = useMemo(
        () => formatHash({ hash: wallet, format: { start: 2, end: 3 } }),
        [wallet]
    );
    const copiedMessage = copiedText ?? "Copied";

    if (!wallet) return null;
    return (
        <button
            type="button"
            onClick={async () => {
                if (!copied) {
                    try {
                        await navigator.clipboard.writeText(wallet);
                        setCopied(true);
                    } catch {
                        // Silently fail if clipboard not available
                    }
                }
            }}
        >
            {copied ? copiedMessage : hashedAddress}
        </button>
    );
}

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
                <ul className={styles.list}>
                    <li className={styles.listItem}>
                        <Box as="span">{t("common.authenticator")}</Box>
                        {isHydrated && (
                            <WalletAddressDisplay
                                wallet={toHex(webauthnWallet.authenticatorId)}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>

                    <li className={styles.listItem}>
                        <Box as="span">{accountLabel}</Box>
                        {isHydrated && (
                            <WalletAddressDisplay
                                wallet={address ?? "0x"}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>
                </ul>
            </Panel>
        );
    }

    if (ecdsaWallet) {
        return (
            <Panel size={"small"}>
                <Title icon={<KeyRound size={32} />}>
                    {t("wallet.settings.ecdsaInfo")}
                </Title>
                <ul className={styles.list}>
                    <li className={styles.listItem}>
                        <Box as="span">{t("wallet.settings.ecdsaWallet")}</Box>
                        {isHydrated && (
                            <WalletAddressDisplay
                                wallet={toHex(ecdsaWallet.publicKey)}
                                copiedText={t("common.copied")}
                            />
                        )}
                    </li>

                    <li className={styles.listItem}>
                        <Box as="span">{accountLabel}</Box>
                        {isHydrated && (
                            <WalletAddressDisplay
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
