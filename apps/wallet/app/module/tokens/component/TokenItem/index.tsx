import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import * as styles from "./index.css";

export function TokenItem({
    token,
    setSelectedValue,
}: {
    token: BalanceItem;
    setSelectedValue?: (value: BalanceItem) => void;
}) {
    return (
        <Box as="li" className={styles.tokenItem}>
            <Box
                as="button"
                type="button"
                className={styles.tokenButton}
                onClick={() => setSelectedValue?.(token)}
                aria-label={`Select ${token.symbol}`}
            >
                <TokenLogo token={token} size={32} />
                <Text as="span" variant="body">
                    <Box as="span" className={styles.tokenAmount}>
                        {token.amount}
                    </Box>{" "}
                    {token.symbol}
                </Text>
            </Box>
        </Box>
    );
}
