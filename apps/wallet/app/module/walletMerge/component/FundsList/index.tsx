import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { LoserAssetSummaryEntry } from "../../hook/useLoserAssetSummary";
import { formatAmount } from "../../utils/formatAmount";

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
                <Spread key={entry.token} space="s">
                    <Text variant="bodySmall" weight="medium">
                        {entry.symbol}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {formatAmount(
                            entry.balance + entry.claimable,
                            entry.decimals
                        )}
                    </Text>
                </Spread>
            ))}
        </Stack>
    );
}
