import { useState } from "react";
import { AlertDialog } from "@/common/component/AlertDialog";
import { TokenList } from "@/tokens/component/TokenList";
import { TokenLogo } from "@/tokens/component/TokenLogo";
import type { BalanceItem } from "@/types/Balance";
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
        <AlertDialog
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
