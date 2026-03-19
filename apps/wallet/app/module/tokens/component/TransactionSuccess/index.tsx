import { Badge } from "@frak-labs/design-system/components/Badge";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { type Hex, slice } from "viem";
import { ExplorerTxLink } from "@/module/wallet/component/ExplorerLink";
import * as styles from "./index.css";

function formatHash(hash: Hex | undefined) {
    if (!hash) return undefined;
    const start = slice(hash, 0, 4);
    const end = slice(hash, -4).replace("0x", "");
    return `${start}...${end}`;
}

export function TransactionSuccess({ hash }: { hash: Hex }) {
    const { t } = useTranslation();
    const formattedHash = formatHash(hash);
    return (
        <Stack space="s" align="center" as="div">
            <Badge variant="success">{t("common.transactionSuccess")}</Badge>
            <Text variant="bodySmall" align="center">
                {t("common.transactionHash")} {formattedHash ?? hash}
            </Text>
            <Text variant="bodySmall" align="center" className={styles.link}>
                <ExplorerTxLink
                    hash={hash}
                    icon={false}
                    className={styles.link}
                    text={t("common.transactionLink")}
                />
            </Text>
        </Stack>
    );
}
