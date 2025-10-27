import { WalletModal } from "@frak-labs/wallet-shared/common/component/WalletModal";
import type { BalanceItem } from "@frak-labs/wallet-shared/types/Balance";
import { useState } from "react";
import { TokenList } from "@/module/tokens/component/TokenList";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import styles from "./index.module.css";

export function TokenModalList({
    token,
    setSelectedToken,
}: {
    token: BalanceItem;
    setSelectedToken?: (value: BalanceItem) => void;
}) {
    const [openModal, setOpenModal] = useState(false);

    return (
        <WalletModal
            title={"Select a token"}
            text={
                <TokenList
                    setSelectedValue={(token) => {
                        setSelectedToken?.(token);
                        setOpenModal(false);
                    }}
                />
            }
            button={{
                label: (
                    <>
                        <TokenLogo token={token} />
                        <span>{token?.symbol}</span>
                    </>
                ),
                className: styles.tokenModalList__trigger,
            }}
            open={openModal}
            onOpenChange={(open) => setOpenModal(open)}
        />
    );
}
