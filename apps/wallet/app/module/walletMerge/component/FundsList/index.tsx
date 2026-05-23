import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { LoserAssetSummaryEntry } from "../../hook/useLoserAssetSummary";
import { formatAmount } from "../../utils/formatAmount";
import * as styles from "./index.css";

type FundsListProps = {
    /** Already-filtered entries with non-zero (balance + claimable). */
    entries: LoserAssetSummaryEntry[];
};

/**
 * Symbol/amount pair list shared by the merge preview recap and the
 * migrate step holdings card. Renders the combined `balance + claimable`
 * value per row — the migration moves both, so showing them as a single
 * number matches the on-chain outcome and avoids a "why do these numbers
 * not add up?" UX trap.
 */
export function FundsList({ entries }: FundsListProps) {
    return (
        <Stack space="xs">
            {entries.map((entry) => (
                <Box key={entry.token} className={styles.balanceRow}>
                    <Text variant="bodySmall" weight="medium">
                        {entry.symbol}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {formatAmount(
                            entry.balance + entry.claimable,
                            entry.decimals
                        )}
                    </Text>
                </Box>
            ))}
        </Stack>
    );
}
