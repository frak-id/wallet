import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import styles from "./index.module.css";

export function TokenItemLite({
    token,
}: {
    token: GetUserErc20Token;
}) {
    // Convert the amount to euro
    const { convertToEuro } = useConvertToEuro();

    return (
        <li className={`${styles.tokenItemLite}`}>
            <TokenLogo token={token} size={16} />{" "}
            {convertToEuro(token.formattedBalance, token.metadata.symbol)}
        </li>
    );
}
