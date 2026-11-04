import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { bank } from "@/data/bank";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { maskIban } from "../../format";
import { walletMessages } from "../../messages";
import type { PhaseTransfer } from "../phases";
import * as styles from "./transferRow.css";

/** A processed payout to the bank, as `MoneriumOrderHistoryItem` draws it. */
export function TransferRow({ transfer }: { transfer: PhaseTransfer }) {
    const t = useT(walletMessages);
    const money = useFormatMoney();

    return (
        <button type="button" className={styles.row}>
            <Inline space="m" padding="m" fill wrap={false}>
                <span className={styles.iconWrapper}>
                    <BankIcon
                        color={vars.text.secondary}
                        width={20}
                        height={20}
                    />
                </span>
                <Inline space="m" align="space-between" fill wrap={false}>
                    <Stack space="xxs" className={styles.info}>
                        <Text variant="body" weight="medium">
                            {t("history.transfer")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {`${maskIban(bank.iban)} · ${t("common.today")}, ${transfer.time}`}
                        </Text>
                    </Stack>
                    <span className={styles.amount}>
                        <Text variant="bodySmall" color="primary">
                            {`−${money(transfer.amount)}`}
                        </Text>
                    </span>
                </Inline>
            </Inline>
        </button>
    );
}
