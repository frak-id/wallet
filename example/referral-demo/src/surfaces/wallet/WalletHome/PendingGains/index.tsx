import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { BottomSheet } from "../../components/BottomSheet";
import { walletMessages } from "../../messages";
import * as styles from "./pendingGains.css";

type PendingGainsProps = {
    amount: number;
    collecting: boolean;
    onCollect: () => void;
};

function CollectButton({
    collecting,
    onCollect,
}: Omit<PendingGainsProps, "amount">) {
    const t = useT(walletMessages);
    return (
        <Button loading={collecting} onClick={onCollect}>
            {t("pendingGains.confirm")}
        </Button>
    );
}

/** `PendingGainsModal`: the wallet's "money is waiting" drawer. */
export function PendingGainsSheet({
    open,
    onClose,
    ...props
}: PendingGainsProps & { open: boolean; onClose: () => void }) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    return (
        <BottomSheet open={open} look="frak" label={t("pendingGains.subtitle")}>
            <button
                type="button"
                className={styles.closeButton}
                aria-label={t("common.close")}
                onClick={onClose}
            >
                <CloseIcon width={24} height={24} />
            </button>
            <Stack space="l" className={styles.sheetBody}>
                <Stack space="xs" align="center">
                    <Stack
                        space="xs"
                        align="center"
                        className={styles.amountBlock}
                    >
                        <Text variant="caption" color="secondary">
                            {t("pendingGains.subtitle")}
                        </Text>
                        <span className={styles.amount}>
                            +{money(props.amount)}
                        </span>
                    </Stack>
                    <Text as="h2" variant="heading2" className={styles.heading}>
                        {t("pendingGains.heading")}
                    </Text>
                    <Text color="secondary">
                        {t("pendingGains.description")}
                    </Text>
                </Stack>
                <CollectButton {...props} />
            </Stack>
        </BottomSheet>
    );
}
