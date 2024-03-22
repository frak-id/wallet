import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { TokenList } from "@/module/tokens/component/TokenList";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import { useState } from "react";
import styles from "./index.module.css";

export function TokenModalList({
    token,
    setSelectedToken,
}: {
    token: GetUserErc20Token;
    setSelectedToken?: (value: GetUserErc20Token) => void;
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
                        <span>{token?.metadata.symbol}</span>
                    </>
                ),
                className: styles.tokenModalList__trigger,
            }}
            open={openModal}
            onOpenChange={(open) => setOpenModal(open)}
        />
    );
}
