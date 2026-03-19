import { Box } from "@frak-labs/design-system/components/Box";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { FrakToken } from "@/module/tokens/component/TokenLogo/FrakToken";
import * as styles from "./index.css";

export function TokenLogo({
    token,
    size = 24,
}: {
    token?: BalanceItem;
    size?: number;
}) {
    return (
        token && (
            <Box
                as="span"
                className={styles.tokenLogo}
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                {token.symbol.indexOf("FRK") >= 0 ? (
                    <FrakToken size={size} />
                ) : null}
            </Box>
        )
    );
}
