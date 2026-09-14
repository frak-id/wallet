import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { useWalletStatus } from "@frak-labs/react-sdk";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { SettingsCard } from "../SettingsCard";
import * as styles from "./wallet-address-card.css";

export function WalletAddressCard() {
    const { t } = useTranslation();
    const { data: walletStatus } = useWalletStatus();
    const address = walletStatus?.wallet ?? "";
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        <SettingsCard title={t("settings.wallet.title")}>
            <div className={styles.row}>
                <Text as="span" variant="bodySmall" className={styles.address}>
                    {address}
                </Text>
                <button
                    type="button"
                    className={clsx(styles.copyButton, copied && styles.copied)}
                    onClick={() => copy(address)}
                    aria-label={t("settings.wallet.copy")}
                    disabled={!address}
                >
                    {copied ? (
                        <CheckIcon width={16} height={16} />
                    ) : (
                        <CopyIcon width={16} height={16} />
                    )}
                </button>
            </div>
        </SettingsCard>
    );
}
