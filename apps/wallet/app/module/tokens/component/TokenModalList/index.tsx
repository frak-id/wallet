import { AlertDialog } from "@/module/common/component/AlertDialog";
import { TokenList } from "@/module/tokens/component/TokenList";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import type { BalanceItem } from "@/types/Balance";
import { useState } from "react";
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
