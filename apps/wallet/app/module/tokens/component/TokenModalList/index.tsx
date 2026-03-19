import { Box } from "@frak-labs/design-system/components/Box";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@frak-labs/design-system/components/Dialog";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useState } from "react";
import { TokenList } from "@/module/tokens/component/TokenList";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import * as styles from "./index.css";

export function TokenModalList({
    token,
    setSelectedToken,
}: {
    token: BalanceItem;
    setSelectedToken?: (value: BalanceItem) => void;
}) {
    const [openModal, setOpenModal] = useState(false);

    return (
        <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
                <Box as="button" type="button" className={styles.trigger}>
                    <TokenLogo token={token} />
                    <Text as="span" variant="label">
                        {token?.symbol}
                    </Text>
                </Box>
            </DialogTrigger>
            <DialogContent>
                <Stack space="m">
                    <DialogTitle>Select a token</DialogTitle>
                    <TokenList
                        setSelectedValue={(token) => {
                            setSelectedToken?.(token);
                            setOpenModal(false);
                        }}
                    />
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
