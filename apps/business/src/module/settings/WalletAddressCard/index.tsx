import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { useWalletStatus } from "@frak-labs/react-sdk";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "../SettingsCard";
import * as styles from "./wallet-address-card.css";

export function WalletAddressCard() {
    const { t } = useTranslation();
    const { data: walletStatus } = useWalletStatus();
    const address = walletStatus?.wallet ?? "";
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (!isCopied) return;
        const timer = setTimeout(() => setIsCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [isCopied]);

    const copy = useCallback(() => {
        if (!address || isCopied || !navigator.clipboard) return;
        navigator.clipboard
            .writeText(address)
            .then(() => setIsCopied(true))
            .catch(() => {});
    }, [address, isCopied]);

    return (
        <SettingsCard title={t("settings.wallet.title")}>
            <div className={styles.row}>
                <Text as="span" variant="bodySmall" className={styles.address}>
                    {address}
                </Text>
                <button
                    type="button"
                    className={clsx(
                        styles.copyButton,
                        isCopied && styles.copied
                    )}
                    onClick={copy}
                    aria-label={t("settings.wallet.copy")}
                    disabled={!address}
                >
                    {isCopied ? (
                        <CheckIcon width={16} height={16} />
                    ) : (
                        <CopyIcon width={16} height={16} />
                    )}
                </button>
            </div>
        </SettingsCard>
    );
}
